const Jimp = require('jimp');
const chai = require('chai');
const expect = chai.expect;

describe('jimp', () => {
    describe('read rgb', () => {
        it('finds pixels', async () => {
            const img = await Jimp.read('test/images/50-50.png');
            let totalR = 0;
            let totalRead = 0;
            for (let x = 0; x < img.bitmap.width; x++) {
                for (let y = 0; y < img.bitmap.height; y++) {
                    const rgb = Jimp.intToRGBA(
                        img.getPixelColor(x, y)
                    );
                    totalR += rgb.r / 255;
                    totalRead ++;
                }
            }
            expect(totalR).to.be.equal(totalRead/2);
            console.log(totalR);
        });
    });
});

