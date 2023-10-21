const http = require('http');
const fs = require('fs');
const url = require('url');
const os = require('os');
const querystring = require('querystring');
const wget = require('node-wget');
const ini = require('ini');

function loadConfig(path) {
  const config = ini.parse(fs.readFileSync(path, 'utf-8'));
  if (!config || !config.port || !config.folder || !config.token_pass) {
    console.log('Veuillez configurer le fichier config.ini');
    process.exit(1);
  }
  return config;
}

const config = loadConfig('./config.ini');

function verifyFolder(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
}

verifyFolder(config.folder);

function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

async function downloadUrls(urlsArray, res) {
  // Votre logique ici...
}

function handleAliveAction(res) {
  const cpuUsage = os.loadavg();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: 'alive', cpuUsage: cpuUsage, alive: true }));
}

function handleListAction(res, folder) {
  
  fs.readdir(folder, (err, files) => {
    if (err) {
      res.statusCode = 500;
      res.end('Erreur interne');
      console.log('Erreur interne');
      return;
    }

    const fileDetails = [];
    let totalSize = 0;
    // Récupérer les détails de chaque fichier
    files.forEach((file) => {
      const filePath = `${config.folder}/${file}`;
      const stats = fs.statSync(filePath);
      totalSize += stats.size; // Calcul de la taille totale
      const fileSize = formatFileSize(stats.size); // Formatage de la taille en format lisible par l'homme

      fileDetails.push({
        filename: file,
        size: fileSize,
        created: stats.birthtime // Date de création
      });
    });

    const jsonResponse = JSON.stringify({ files: fileDetails, totalSize: formatFileSize(totalSize) });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(jsonResponse);
  });

  return;


}

function handleDownloadAction(res, queryParams, folder) {
    const file = queryParams.file;
    const filePath = `${config.folder}/${file}`;
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('Content-Length', fileSize);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    console.log('Téléchargement du fichier ' + file + ' en cours...');
    return;
}

function handleDeleteAction(res, queryParams, folder) {
  const file = queryParams.file;
  //let be sure that file is in the folder care about the security and ..
  file.replace('..','');

  const filePath = `${config.folder}/${file}`;
  fs.unlink(filePath, (err) => {
    if (err) {
      res.statusCode = 500;
      res.end('Erreur interne');
      console.log('Erreur interne');
      return;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({message:'Fichier supprimé'}));
    console.log('Fichier supprimé');
  });
  return;
}

function handleDefault(res) {
  res.end('Action non supportée');
}

function handlePostRequest(req, res) {
  let body = '';
  req.on('data', function (data) {
    body += data;
    if (body.length > 1e6) req.connection.destroy();
  });

  req.on('end', function () {
    const post = JSON.parse(body);
    if (post.urls) {
      downloadUrls(post.urls, res);
    } else {
      console.error('Champ "urls" manquant dans les données JSON.');
    }
  });
}

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);

  if (queryParams.token !== config.token_pass) {
    res.statusCode = 401;
    res.end('Token invalide');
    return;
  }

  if (req.method === 'POST') {
    handlePostRequest(req, res);
    return;
  }

  const action = queryParams.action;
  switch (action) {
    case 'alive':
      handleAliveAction(res);
      break;
    case 'list':
      handleListAction(res, config.folder);
      break;
    case 'download':
      handleDownloadAction(res, queryParams, config.folder);
      break;
    case 'delete':
      handleDeleteAction(res, queryParams, config.folder);
      break;
    default:
      handleDefault(res);
  }
}

const server = http.createServer(handleRequest);

server.listen(config.port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${config.port}`);
});





