const log4js = require('log4js');

log4js.addLayout('json', config => function (logEvent) {
    return '# ' + JSON.stringify(logEvent.data.join('\n'));
});

log4js.configure({
    appenders: {
        out: { type: 'stdout', layout: { type: 'json', separator: ',' } }
    },
    categories: {
        default: { appenders: ['out'], level: 'info' }
    }
});

module.exports.logger = log4js.getLogger();
