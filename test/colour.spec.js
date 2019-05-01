const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

describe('color', () => {
    const h = new Horizon({
        input: './test/images/la.jpg',
        output: './test/output/',
        logger: logger
    });

    it('loads a colour image', async () => {
        await h.load();
        expect(h.imgClr).not.to.be.undefined;
    });

    // it('gets a colour pixel', () => {
    //     const c = h.getColor(0,0);
    //     console.log(c);
    // });

});

