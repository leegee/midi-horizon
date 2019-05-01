const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

logger.level = 'trace';

describe('highest notes', () => {
    let h;

    it('should construct', async () => {
        h = new Horizon({
            input: './test/images/london.jpg',
            output: './test/output/',
            x: 100,
            velocityScaleMax: 10,
            minVelocityPostScale: 2,
            logger
        });

        await h.load();

        expect(h.img.bitmap.width).to.equal(h.staveX);
        expect(h.img.bitmap.height).to.equal(h.staveY);

        h._getPixels();
        expect(h.px[0][0]).to.be.ok;
        h._linear();
        expect(h.notes[0][0]).to.be.ok;
    });

    it('should extract and save', async () => {

        h._getHighestNotes();
        h._saveHighestNotes();

        expect(h.outputMidiPath, 'midi path').to.match(
            /test[\\\/]output[\\\/]london\.jpg_hi\.mid$/
        );

        h._saveAsOneTrack();
        expect(
            h.outputMidiPath
        ).to.be.a.file(h.outputMidiPath);
    });
});

