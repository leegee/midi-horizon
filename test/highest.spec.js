const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

describe('highest notes', () => {
    it('should extract and save', async () => {
        const h = new Horizon({
            input: './test/images/london.jpg',
            output: './test/output/',
            logger: logger
        });

        await h.load();
        h._getPixels();
        h._linear();
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

