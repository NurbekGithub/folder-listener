const cp = require("child_process");
const path = require("path");
const fs = require("fs");
const mime = require("mime");
const iconvlite = require("iconv-lite");

const chokidar = require("chokidar");
const http = require("http").createServer();
const io = require("socket.io")(http);

const pathToHorusFolder = path.join(
  process.cwd(),
  "HorusUVCView_1.2.0.0"
);
const pathToHorusConfig = path.join(
  __dirname,
  "HorusUVCView_1.2.0.0",
  "config.ini"
);

// =======================================================
// FIND STILL_PATH TO WATCH
// =======================================================
function getStillFolderToWatch() {
  try {
    const configFile = iconvlite.decode(
      fs.readFileSync(pathToHorusConfig),
      "windows-1251"
    );
    const stillPath = configFile
      .split("\n")
      .find(path => path.startsWith("StillPath"))
      .split("=")[1]
      .replace(/(\n|\r|\\)+$/, "").trim();

    return process.env.NODE_ENV === "development"
      ? "/home/nurbek/Pictures"
      : stillPath;
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
    launchHorus();

    if (!stillPath) handleError("Still path not found");
    watchStillPath(stillPath);
    watchConfigFile();
  } catch (error) {
    console.error(error);
    handleError(error);
  }
});

// =======================================================
// LAUNCH HORUS APP
// =======================================================
function launchHorus() {
  const execCmd = `cd ${pathToHorusFolder} && start HorusUVCView.exe`;
  cp.exec(execCmd, err => {
    if (err) {
      handleError(err);
    }
  });
}

// =======================================================
// WATCH STILL PATH
// =======================================================
function watchStillPath(pathToWatch) {
  chokidar
    .watch(pathToWatch, { ignored: /(^|[\/\\])\../, ignoreInitial: true })
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
function watchConfigFile() {
  chokidar
    .watch(pathToHorusConfig, { ignored: /(^|[\/\\])\../ })
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