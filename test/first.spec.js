const chai = require('chai');

const Horizon = require('../src/Horizon.mjs');
const logger = require('./Logger-test.mjs');

const expect = chai.expect;
chai.use(require('chai-fs'));

describe('general', () => {
    const h = new Horizon({
        input: './test/images/london.jpg',
        output: './test/output/',
        logger: logger
    });

    describe('basics', () => {
        it('constructs', () => {
            expect(h).to.be.an.instanceOf(Horizon);
        });
    });

    it('should produce correct paths', () => {
        expect(h._inputFilename).to.equal('london.jpg');
        expect(h.outputImgPath, 'img path').to.match(
            /test[\\\/]output[\\\/]london\.jpg_tmp\.png$/
        );
        expect(h.outputMidiPath, 'midi path').to.match(
            /test[\\\/]output[\\\/]london\.jpg\.mid$/
        );
        expect(h._outputDir).to.match(/test[\\\/]output[\\\/]?/);
    });

    describe('scales velocity', () => {
        it('scale max', () => {
            expect(h.velocityScaleMax, 'velocityScaleMax').to.equal(127);
        })
        it('100%', () => {
            expect(h._normaliseVelocity(Horizon.MAX_VELOCITY_IN_PIXEL), 'scaled 100%').to.equal(127);
        })
        it('50%', () => {
            expect(h._normaliseVelocity(Horizon.MAX_VELOCITY_IN_PIXEL / 2), 'scaled 50%').to.equal(63.5);
        })

        it('at 100', () => {
            const h = new Horizon({
                input: './test/images/london.jpg',
                output: './test/output/',
                velocityScaleMax: 100
            });
            expect(h).to.be.an.instanceOf(Horizon);
            expect(h.velocityScaleMax, 'velocityScaleMax').to.equal(100);
            expect(h._normaliseVelocity(Horizon.MAX_VELOCITY_IN_PIXEL), 'scaled').to.equal(100);
            expect(h._normaliseVelocity(Horizon.MAX_VELOCITY_IN_PIXEL / 2), 'scaled').to.equal(50);
        });
    });

    describe('resize', () => {
        const h = new Horizon({
            input: './test/images/london.jpg',
            output: './test/output/',
            logger: logger,
            x: 100,
            velocityScaleMax: 10,
            minUnscaledVelocity: .2
        });

        it('should resize input image', async () => {
            await h.load();
            expect(h.img.bitmap.width).to.equal(h.staveX, 'x');
            expect(h.img.bitmap.height).to.equal(h.staveY, 'y');
        }).timeout(60 * 1000 * 2);

        it('should get image data', async () => {
            await h._getPixels();

            for (let x = 0; x < this.staveX; x++) {
                for (let y = 0; y < this.staveY; y++) {
                    expect(h.px[x][y]).not.to.be.undefined;
                }
            }
        });

        it('linear should produce MIDI data', () => {
            h._linear();
        });

        it('should save a .mid file', () => {
            h._saveAsOneTrack();
            expect(
                h.outputMidiPath
            ).to.be.a.file(h.outputMidiPath);
        });
    });
});
