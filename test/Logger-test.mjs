const log4js = require('log4js');

log4js.addLayout('mylayout', config => function (logEvent) {
    return '# ' +
        logEvent.data.map(
            o => JSON.stringify(o)
        ).join(' ');
});

log4js.configure({
    appenders: {
        out: { type: 'stdout', layout: { type: 'mylayout', separator: ',' } }
    },
    categories: {
        default: { appenders: ['out'], level: 'info' }
    }
});

module.exports = log4js.getLogger();
