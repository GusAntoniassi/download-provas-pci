const fs = require('fs');
const readlines = require('n-readlines');
const $ = require('cheerio');
const slugify = require('slugify');
const https = require('https');

if (process.argv.length < 3) {
    console.log('Utilização: node ' + process.argv[1] + ' <lista-de-links.txt>');
    process.exit(1);
}

const filename = process.argv[2];

const csvFile = fs.createWriteStream('./concursos.csv');
csvFile.write('Ano,Instituição,Órgão,Cargo,Arquivo' + "\n");

const liner = new readlines(filename);

(async function() {
    let line;
    while (line = liner.next()) {
        const url = line.toString();

        if (!url) {
            return;
        }

        console.log(`Baixando prova [${url}]...`);
        
        const html = await getHtmlConcurso(url);

        const info = getFileInfo(html);

        if (!info) {
            console.error('Erro ao pegar as informações do arquivo!');
            return;
        }

        const downloadLink = $('ul.zip a', html).attr('href');
        const extension = downloadLink.split('.').pop();

        const filename = slugify(`${info.ano}_${info.instituicao}_${info.orgao}_${info.cargo}`) + `.${extension}`;

        try {
            await downloadFile(downloadLink, filename);
        } catch (e) {
            console.error('Erro ao fazer o download do arquivo', e);
        }

        try {
            await writeToCsv(info, filename);
        } catch (e) {
            console.error('Erro ao gravar no CSV', e);
        }
    }

    csvFile.close();
})();

async function getHtmlConcurso(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            var body = '';

            response.on('data', (chunk) => {
                body += chunk;
            })

            response.on('end', () => {
                resolve(body);
            })
        })
    });
}

function getFileInfo(html) {
    var infoHtml = $('ul.linkd', html).text();

    const info = infoHtml.match(
        /Cargo: (.*?)Ano: (.*?)Órgão: (.*?)Instituição: (.*?)Nível: .*?/
    );

    if (!info) {
        return null;
    }

    [all, cargo, ano, orgao, instituicao, ...rest] = info;

    return {
        cargo,
        ano,
        orgao,
        instituicao
    };
}

async function downloadFile(url, filename) {
    if (!fs.existsSync('./download')) {
        fs.mkdirSync('./download');
    }

    console.log(`Gravando arquivo ${filename}`);

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (!response) {
                reject();
            }

            const file = fs.createWriteStream('./download/' + filename);
            const stream = response.pipe(file);

            stream.on('finish', function () {
                resolve();
            });
        });
    });
}

async function writeToCsv(info, filename) {
    console.log('Atualizando arquivo CSV');

    return new Promise((resolve, reject) => {
        csvFile.write(`${info.ano};${info.instituicao};${info.orgao};${info.cargo};${filename}\n`, function (err) {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
}