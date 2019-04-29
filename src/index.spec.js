const chai = require('chai');

const Horizon = require('./Horizon.mjs');

const expect = chai.expect;

describe('horizon', () => {

    describe('constructor', async () => {
        it('constructs', () => {
            const h = new Horizon({
                input: './test/london.jpg'
            });
            expect(h).to.be.an.instanceOf(Horizon);
        });
    });

    describe('resize', () => {
        it('should resize input image', async () => {
            const h = new Horizon({
                input: './test/london.jpg'
            });
            await h.prepare();

            
            expect(h.img.bitmap.width).to.equal(h.staveX, 'x');
            expect(h.img.bitmap.height).to.equal(h.staveY, 'y');

            await h.getData();

            console.log(data);
            for (let x = 0; x < this.staveX; x++) {
                for (let y = 0; y < this.staveY; y++) {
                    expect(h.px[x][y]).not.to.be.undefined;
                }
            }
        });
    });
});