const Jimp = require('jimp');

const main = async () => {
    const img = await new Jimp(100, 100, '#FFFFFF');
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 100; x++) {
            img.setPixelColor(
                Jimp.cssColorToHex('#000000'), x, y
            );
        }
    }

    img.writeAsync('test/images/50-50.png')
}

main();