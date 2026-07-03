const { app, BrowserWindow, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let serverProcess = null;

const isDev = process.env.NODE_ENV === 'development';
const SERVER_PORT = process.env.SERVER_PORT || 3001;

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'dist', 'index.js');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: String(SERVER_PORT), NODE_ENV: 'production' },
    stdio: 'pipe',
  });
  serverProcess.stdout.on('data', (data) => console.log(`[Server] ${data}`));
  serverProcess.stderr.on('data', (data) => console.error(`[Server Error] ${data}`));
  serverProcess.on('close', (code) => console.log(`[Server] exited with code ${code}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'LexiStrike Global',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0A0A0A',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const template = [
    {
      label: 'LexiStrike',
      submenu: [
        { label: '关于', click: () => dialog.showMessageBox({ title: 'LexiStrike Global', message: '版本 2.0.0\n智能化三端学习平台', type: 'info' }) },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '学习',
      submenu: [
        { label: '数学', click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/math-home'") },
        { label: '英语', click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/english-home'") },
        { label: '英语游戏', click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/english-games'") },
        { type: 'separator' },
        { label: '模拟考试', click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/mock-exam'") },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('LexiStrike Global');
    tray.on('double-click', () => mainWindow?.show());
  } catch {}
}

app.whenReady().then(() => {
  if (!isDev) startServer();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});