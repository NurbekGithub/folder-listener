const path = require("path");
const fs = require("fs");
const mime = require("mime");
const iconvlite = require("iconv-lite");

const chokidar = require("chokidar");
const http = require("http").createServer();
const io = require("socket.io")(http);
const dialog = require("dialog-node");

const pathToConfigFile = path.join(__dirname, "config.txt");

function cleanPath(path) {
  return path.replace(/(\n|\r|\\)+$/, "").trim();
}

// =======================================================
// FIND STILL_PATH TO WATCH
// =======================================================
function setStillFolderToWatch(path) {
  try {
    fs.writeFileSync(pathToConfigFile, `StillPath=${path}`);
  } catch (error) {
    console.error(error);
    handleError(error);
  }
}
function getStillFolderToWatch() {
  try {
    const configFile = iconvlite.decode(
      fs.readFileSync(pathToConfigFile),
      "windows-1251"
    );
    const stillPath = cleanPath(
      configFile
        .split("\n")
        .find(path => path.startsWith("StillPath"))
        .split("=")[1]
    );

    return stillPath;
  } catch (error) {
    console.error(error);
    handleError(error);
  }
}
const stillPath = getStillFolderToWatch();

// =======================================================
// OPEN PART
// =======================================================
http.listen(23955, function() {
  try {
    log("listening on *:23955");

    if (stillPath) {
      watchStillPath(stillPath);
      watchConfigFile();
    }

    openDialog(function cb(newStillPath) {
      watchStillPath(newStillPath);
      watchConfigFile();
    });
  } catch (error) {
    console.error(error);
    handleError(error);
  }
});

// =======================================================
// OPEN PATH DIALOG
// =======================================================
function openDialog(callback) {
  dialog.entry("msg", "title", 1000, function cb(code, retVal) {
    const newStillPath = cleanPath(retVal);
    callback(newStillPath);
    setStillFolderToWatch(newStillPath);
  });
}

// =======================================================
// WATCH STILL PATH
// =======================================================
function watchStillPath(pathToWatch) {
  chokidar
    .watch(pathToWatch, { ignored: /(^|[/\\])\../, ignoreInitial: true })
    .on("add", path => {
      log("watchStillPath" + ": " + path);
      setTimeout(() => {
        const base64 = fs.readFileSync(path, { encoding: "base64" });
        const filemime = mime.getType(path);
        const data = `data:${filemime};base64,${base64}`;
        io.emit("file_added", data);
      }, 400);
    })
    .on("error", handleError);
}

// =======================================================
// WATCH CONFIG FILE
// =======================================================
function watchConfigFile(pathToConfigFile) {
  chokidar
    .watch(pathToConfigFile, { ignored: /(^|[/\\])\../ })
    .on("change", () => {
      log("watchConfigFile", +": " + "pathToHorusConfig");
      const stillPath = getStillFolderToWatch();
      watchStillPath(stillPath);
    })
    .on("error", handleError);
}

// =======================================================
// ERROR HANDLER
// =======================================================
function handleError(text) {
  log(text, () => {
    process.exit(0); // exit this nodejs process
  });
}

function log(text, cb) {
  const stream = fs.createWriteStream("logs.txt", { flags: "a" });
  stream.write(new Date() + "\r\n" + text + "\r\n");
  stream.end();
  stream.on("finish", () => {
    cb && cb();
  });
}
