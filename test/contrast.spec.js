const Jimp = require('jimp');
const chai = require('chai');
const Horizon = require('../src/Horizon.mjs');
const logger = require('./Logger-test.mjs');

const expect = chai.expect;
chai.use(require('chai-fs'));

logger.level = 'trace';

describe('general', () => {
    const h = new Horizon({
        input: './test/images/london.jpg',
        output: './test/output/',
        logger: logger
    });

    describe('contrast', () => {
        const contrastLevel = 0.8;

        it('_countAdjacentPoints black', async () => {
            const h = new Horizon({
                input: './test/images/black.jpg',
                output: './test/output/',
                staveX: 100
            });
            h.img = await Jimp.read(h.input);
            h.colourImage = h.img.clone();
            await h.img.contrast(contrastLevel).greyscale();
            h._getPixels();
            expect(h._countAdjacentPoints(0.5)).to.equal(0);
        });

        it('_countAdjacentPoints white', async () => {
            const h = new Horizon({
                input: './test/images/white.jpg',
                output: './test/output/',
                staveX: 100
            });
            h.img = await Jimp.read(h.input);
            h.colourImage = h.img.clone();
            await h.img.contrast(contrastLevel).greyscale();
            h._getPixels();
            expect(h._countAdjacentPoints(0.5)).to.equal(1);
        });

        it('_countAdjacentPoints 50:50 at contrast ' + contrastLevel, async () => {
            const h = new Horizon({
                input: './test/images/50-50.png',
                output: './test/output/'
            });
            h.staveY = h.staveX = 50;
            h.img = await Jimp.read(h.input);
            await h.img.resize(h.staveX, h.staveY, Jimp.RESIZE_NEAREST_NEIGHBOR)
            h.colourImage = h.img.clone();
            await h.img.contrast(contrastLevel).greyscale().invert();
            h._getPixels();
            expect(h._countAdjacentPoints(contrastLevel)).to.be.greaterThan(0.48);
        });

    });
});

