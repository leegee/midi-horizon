const Jimp = require('jimp');
const chai = require('chai');
const Horizon = require('../src/Horizon.mjs');
const logger = require('./Logger-test.mjs');

const expect = chai.expect;
chai.use(require('chai-fs'));

const DEFAULT_CONTRAST = 0.5;

// logger.level = 'trace';

const h = new Horizon({
    input: './test/images/london.jpg',
    output: './test/output/',
    logger: logger
});

describe('contrast', () => {
    it('_countAdjacentPoints 100% black', async () => {
        const h = new Horizon({
            input: './test/images/black.jpg',
            output: './test/output/',
            staveX: 100
        });
        h.img = await Jimp.read(h.input);
        h.colourImage = h.img.clone();
        await h.img.contrast(DEFAULT_CONTRAST).greyscale();
        h._getPixels();
        expect(h._countAdjacentPoints(DEFAULT_CONTRAST)).to.equal(0);
    });

    it('_countAdjacentPoints 100% white', async () => {
        const h = new Horizon({
            input: './test/images/white.jpg',
            output: './test/output/',
            staveX: 100
        });
        h.img = await Jimp.read(h.input);
        h.colourImage = h.img.clone();
        await h.img.contrast(DEFAULT_CONTRAST).greyscale();
        h._getPixels();
        expect(h._countAdjacentPoints(DEFAULT_CONTRAST)).to.equal(1);
    });

    it('_countAdjacentPoints 50:50 ' + DEFAULT_CONTRAST, async () => {
        const h = new Horizon({
            input: './test/images/50-50.png',
            output: './test/output/'
        });
        h.staveY = h.staveX = 50;
        h.img = await Jimp.read(h.input);
        await h.img.resize(h.staveX, h.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
        h.colourImage = h.img.clone();
        await h.img.contrast(DEFAULT_CONTRAST).greyscale().invert();
        h._getPixels();
        expect(h._countAdjacentPoints(DEFAULT_CONTRAST)).to.be.greaterThan(0.48);
    });

    const fin = {
        contrast: 0,
        rv: 0
    };
    for (let contrast = 0.1; contrast < 1; contrast += 0.1) {
        xit('_countAdjacentPoints 50:50 ' + contrast, async () => {
            const h = new Horizon({
                input: './test/images/50-50.png',
                output: './test/output/'
            });
            h.staveY = h.staveX = 50;
            h.img = await Jimp.read(h.input);
            await h.img.resize(h.staveX, h.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            h.colourImage = h.img.clone();
            await h.img.contrast(DEFAULT_CONTRAST).greyscale().invert();
            h._getPixels();
            const rv = h._countAdjacentPoints(contrast);
            expect(rv).to.be.greaterThan(0.0);
            if (rv > fin.rv) {
                console.log('rv - fin.rv', rv - fin.rv);
                fin.contrast = contrast;
                fin.rv = rv;
                console.log('REPORT: contrast=%d, rv=%d', contrast, rv);
            }
        });
    }

});

describe('la', () => {
    const fin = {
        contrast: 0,
        rv: 0
    };
    for (let contrast = 0.1; contrast < 1; contrast += 0.1) {
        it('_countAdjacentPoints LA ' + contrast, async () => {
            const h = new Horizon({
                input: './test/images/la.jpg',
                output: './test/output/'
            });
            h.staveY = h.staveX = 50;
            h.img = await Jimp.read(h.input);
            await h.img.resize(h.staveX, h.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            h.colourImage = h.img.clone();
            await h.img.contrast(DEFAULT_CONTRAST).greyscale().invert();
            h._getPixels();
            const rv = h._countAdjacentPoints(contrast);
            expect(rv).to.be.greaterThan(0.0);
            if (rv > fin.rv) {
                console.log('rv - fin.rv', rv - fin.rv);
                fin.contrast = contrast;
                fin.rv = rv;
                console.log('REPORT: contrast=%d, rv=%d', contrast, rv);
            }
        });
    }
});

