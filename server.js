const http = require('http');
const fs = require('fs');
const url = require('url');
const os = require('os');
const querystring = require('querystring');
const wget = require('node-wget');
const formidable = require('formidable');
const torrentStream = require('torrent-stream');
var Client = require('node-torrent');
var client = new Client({logLevel: 'DEBUG'});
const ini = require('ini');
const path = require('path');
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

  await Promise.all(
    urlsArray.map((url, index) => downloadUrl(url, config.folder, index))
  );
  console.log('Tous les téléchargements sont terminés.');
}

function downloadUrl(url, downloadFolder, index) {
  return new Promise((resolve, reject) => {
   // const filePath = path.join(downloadFolder, filename);

   let fileName = (path.basename(url));
   //beautify fileName by removing %20 and other stuff
   fileName = decodeURIComponent(fileName);

   const extension = path.extname(fileName);
    
   
   let filePath = downloadFolder;
    wget(
      {
        url: url,
        dest: filePath + '/'+fileName,
      },
      (error, response) => {
        if (error) {
          console.error(`Erreur lors du téléchargement de ${url}:`, error);
          reject(error);
        } else {
          console.log(`Téléchargé : ${url}`);
          if (extension === '.torrent') {
            downloadTorrentIfTorrentFile(filePath + '/torr-'+fileName, downloadFolder);
          }
          resolve(response);
        }
      }
    );
  });

}



async function downloadTorrentIfTorrentFile(filePath, downloadFolder) {
  // Vérifiez si l'extension du fichier est ".torrent"
  if (!filePath.endsWith('.torrent')) {
    console.log('Ce n\'est pas un fichier torrent.');
    return;
  }


  console.log("Torrent file detected",filePath);
  var torrent = client.addTorrent(filePath);

  // when the torrent completes, move it's files to another area
  torrent.on('complete', function() {
      console.log('complete!');
      torrent.files.forEach(function(file) {
          var newPath = downloadFolder+'/' + file.path;
          fs.rename(file.path, newPath);
          // while still seeding need to make sure file.path points to the right place
          file.path = newPath;
      });
  });
  torrent.on('ready', function() {
      console.log('ready!');
      torrent.files.forEach(function(file) {
          console.log('filename:', file.name);
          console.log('size:', file.length);
      });
  });
  torrent.on('download', function(chunkSize) {
      console.log('chunkSize:', chunkSize);
  });
  torrent.on('upload', function(chunkSize) {
      console.log('chunkSize:', chunkSize);
  });
  

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
      console.log('Erreur interne',err);
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

function handleUploadAction(req, res, folder) {










  
  //handle formdata llike this formData.append('file'+i, file);
  const form = new formidable.IncomingForm();
  form.uploadDir = folder;
  form.keepExtensions = true;
  form.multiples = true;

  //keep same name as the file uploaded
  form.on('fileBegin', function (name, file) {
    file.path = form.uploadDir + "/" + file.name;
    file.filepath= form.uploadDir + "/" + file.originalFilename;
  });
  form.on('file', function (name, file) {
    console.log('fichier finiu')
    downloadTorrentIfTorrentFile(file.filepath , folder);

  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.statusCode = 500;
      res.end('Erreur interne');
      console.log('Erreur interne');
      return;
    }


    res.statusCode = 200;
    res.end(JSON.stringify({message:'Fichier uploadé',success:true}));
    //get the file path





    console.log('Fichier uploadé');
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
    case 'upload':
      handleUploadAction(req, res, config.folder);
      break;
    case 'urls':
      handlePostRequest(req, res);
      break;

    default:
      handleDefault(res);
  }
}

const server = http.createServer(handleRequest);

server.listen(config.port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${config.port}`);
});





