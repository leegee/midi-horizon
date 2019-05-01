const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');

const logger = require('./Logger-test.mjs');
const expect = chai.expect;
chai.use(require('chai-fs'));

describe('color', () => {
    it('dubai', async () => {
        const h = new Horizon({
            input: './test/images/liverpool.jpg',
            output: './test/output/',
            logger: logger,
            contrast: 0.8
        });

        await h.load();
        h._getPixels();
        h._linear();

        h._getHighestNotes();
        h._processColours();

        h._saveColouredHighestNotes();

        expect(h.outputMidiPath).to.match(/_coloured\.mid$/);

        expect(
            h.outputMidiPath
        ).to.be.a.file(h.outputMidiPath);
    });

});

