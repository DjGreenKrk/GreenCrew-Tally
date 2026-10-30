// transport
const _virtualTerminal = require('./transport/scriptable-serial-terminal');

// import connector tasks
// Trimmed to what NodeMcuConnector.ts actually uses (no CLI-only compile/
// format/remove/run tasks) when this was vendored from nodemcu-tool.
const _checkConnection = require('./connector/check-connection');
const _connect = require('./connector/connect');
const _deviceInfo = require('./connector/device-info');
const _devices = require('./connector/list-devices');
const _execute = require('./connector/execute');
const _fsinfo = require('./connector/fsinfo');
const _reset = require('./connector/reset');
const _download = require('./connector/download');
const _upload = require('./connector/upload');

module.exports = {
    onError: _virtualTerminal.onError,
    disconnect: _virtualTerminal.disconnect,
    connect: _connect,
    isConnected: _virtualTerminal.isConnected,
    checkConnection: _checkConnection,
    deviceInfo: _deviceInfo,
    listDevices: _devices,
    download: _download,
    upload: _upload,
    execute: _execute,
    fsinfo: _fsinfo,
    softreset: _reset.softreset,
    hardreset: _reset.hardreset
};
