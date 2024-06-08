"use strict";

const Filters = {};
const pi = Math.PI;

////////////////////////////////////////////////////////////////////////////////
// General utility functions
////////////////////////////////////////////////////////////////////////////////

// Constrain val to the range [min, max]
function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
}

// Extract vertex coordinates from a URL string
function stringToCoords(vertsString) {
    const centers = [];
    const coordStrings = vertsString.split("x");
    for (let i = 0; i < coordStrings.length; i++) {
        const coords = coordStrings[i].split("y");
        const x = parseInt(coords[0]);
        const y = parseInt(coords[1]);
        if (!isNaN(x) && !isNaN(y)) {
            centers.push({ x: x, y: y });
        }
    }
    return centers;
}

// Blend scalar start with scalar end. Note that for image blending,
// end would be the upper layer, and start would be the background
function blend(start, end, alpha) {
    return start * (1 - alpha) + end * alpha;
}

////////////////////////////////////////////////////////////////////////////////
// Filters
////////////////////////////////////////////////////////////////////////////////

Filters.fillFilter = function(image, color) {
    image.fill(color);
    return image;
};

Filters.brushFilter = function(image, radius, color, vertsString) {
    // centers is an array of (x, y) coordinates that each defines a circle center
    const centers = stringToCoords(vertsString);

    // draw a filled circle centered at every location in centers[].
    // radius and color are specified in function arguments.
    let center_X, center_Y, radiusSquar;
    for (let index = 0; index < centers.length; index++) {
        center_X = centers[index].x;
        center_Y = centers[index].y;
        for (let a = center_X - radius; a < center_X + radius; a++) {
            for (let b = center_Y - radius; b < center_Y + radius; b++) {
                // Only color points within the square AND within the circle (a^2+b^2=radius^2 -- respective to current center)
                radiusSquar = Math.pow((a-center_X),2)+Math.pow((b-center_Y), 2)
                if (radiusSquar <= Math.pow(radius, 2)) {
                image.setPixel(a, b, color);
                }
            }
        }
    }
    return image;
};

Filters.softBrushFilter = function(image, radius, color, alpha_at_center, vertsString) {
    // centers is an array of (x, y) coordinates that each defines a circle center
    const centers = stringToCoords(vertsString);

    // draw a filled circle with opacity equals to alpha_at_center at the center of each circle
    // the opacity decreases linearly along the radius and becomes zero at the edge of the circle
    // radius and color are specified in function arguments.
    let center_X, center_Y, radiusSquar, currAlpha;
    for (let index = 0; index < centers.length; index++) {
      center_X = centers[index].x;
      center_Y = centers[index].y;
      for (let a = center_X - radius; a < center_X + radius; a++) {
        for (var b = center_Y - radius; b < center_Y + radius; b++) {
          // Only color points within the square AND within the circle (a^2+b^2=radius^2 -- respective to current center)
          radiusSquar = Math.pow((a-center_X),2)+Math.pow((b-center_Y), 2);
          if (radiusSquar <= Math.pow(radius, 2)) {
            // use the current radius to find its percentage of the original and multiply it by alpha_at_center to get the proportional alpha amount
            currAlpha = alpha_at_center-((Math.sqrt(radiusSquar)/radius)*alpha_at_center);
            let oldColor = image.getPixel(a, b);
            let newColor = new Pixel();
            // create a blend of the old and new color depending on the current alpha amount
            newColor.data[0] = ((oldColor.data[0]*(1-currAlpha))+(color.data[0]*(currAlpha)));
            newColor.data[1] = ((oldColor.data[1]*(1-currAlpha))+(color.data[1]*(currAlpha)));
            newColor.data[2] = ((oldColor.data[2]*(1-currAlpha))+(color.data[2]*(currAlpha)));
            image.setPixel(a, b, newColor);
          }
        }
      }
    }
    return image;
};

// Ratio is a value in the domain [-1, 1]. When ratio is < 0, linearly blend the image
// with black. When ratio is > 0, linearly blend the image with white. At the extremes
// of -1 and 1, the image should be completely black and completely white, respectively.
Filters.brightnessFilter = function(image, ratio) {
    let alpha, dirLuminance;
    if (ratio < 0.0) {
        alpha = 1 + ratio;
        dirLuminance = 0; // blend with black
    } else {
        alpha = 1 - ratio;
        dirLuminance = 1; // blend with white
    }
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);

            pixel.data[0] = alpha * pixel.data[0] + (1 - alpha) * dirLuminance;
            pixel.data[1] = alpha * pixel.data[1] + (1 - alpha) * dirLuminance;
            pixel.data[2] = alpha * pixel.data[2] + (1 - alpha) * dirLuminance;

            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

// Reference at this:
//      https://en.wikipedia.org/wiki/Image_editing#Contrast_change_and_brightening
// value = (value - 0.5) * (tan ((contrast + 1) * PI/4) ) + 0.5;
// Note that ratio is in the domain [-1, 1]
Filters.contrastFilter = function(image, ratio) {
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);

            pixel.data[0] = (pixel.data[0]-0.5)*Math.tan((ratio+1)*(Math.PI/4)) + 0.5;
            pixel.data[1] = (pixel.data[1]-0.5)*Math.tan((ratio+1)*(Math.PI/4)) + 0.5;
            pixel.data[2] = (pixel.data[2]-0.5)*Math.tan((ratio+1)*(Math.PI/4)) + 0.5;

            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

Filters.gammaFilter = function(image, logOfGamma) {
    const gamma = Math.exp(logOfGamma);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);

            pixel.data[0] = Math.pow(pixel.data[0], gamma);
            pixel.data[1] = Math.pow(pixel.data[1], gamma);
            pixel.data[2] = Math.pow(pixel.data[2], gamma);

            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

/*
* The image should be perfectly clear up to innerRadius, perfectly dark
* (black) at outerRadius and beyond, and smoothly increase darkness in the
* circular ring in between. Both are specified as multiples of half the length
* of the image diagonal (so 1.0 is the distance from the image center to the
* corner).
*
* Note that the vignette should still form a perfect circle!
*/
Filters.vignetteFilter = function(image, innerR, outerR) {
    innerR = clamp(innerR, 0, outerR - 0.1);
    let centerX = image.width/2;
    let centerY = image.height/2;
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            let pixel = image.getPixel(x,y);
            let currRadius = (Math.pow(x-centerX, 2) + Math.pow(y-centerY, 2))/(Math.pow(centerX,2)+(Math.pow(centerY,2)));
            if (currRadius >= outerR) {
                for (let c = 0; c < 3; c++) {
                    pixel.data[c] = 0;
                }
            }
            else if (currRadius > innerR && currRadius < outerR) {
                let currAlpha = ((outerR-currRadius))/(outerR-innerR);
                for (let c = 0; c < 3; c++) {
                    pixel.data[c] = ((pixel.data[c]*(currAlpha)));
                }
            }
            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

/*
* You will want to build a normalized CDF of the L channel in the image.
*/
Filters.histogramEqualizationFilter = function(image) {
    let luminanceM = new Map();
    for (let x =0; x < image.width; x++) {
        for (let y =0; y < image.height; y++) {
            let pixel = image.getPixel(x,y);
            let luminance = 0.2126 * pixel.data[0] + 0.7152 * pixel.data[1] + 0.0722 * pixel.data[2];
            luminance = luminance.toFixed(2);
            if (luminanceM.has(luminance)) {
                luminanceM.set(luminance, luminanceM.get(luminance) + 1);
            }
            else {
                luminanceM.set(luminance, 1);
            }
        }
    }
    let sorted = new Map([...luminanceM.entries()].sort());
    let cdfMap = new Map();
    let cdf = 0;

    for (const [lum, occurance] of sorted) {
        cdf += occurance / (image.width*image.height);
        cdfMap.set(lum, cdf);
    }

    for (let x =0; x < image.width; x++) {
        for (let y =0; y < image.height; y++) {
            let pixel = image.getPixel(x,y);
            let luminance = 0.2126 * pixel.data[0] + 0.7152 * pixel.data[1] + 0.0722 * pixel.data[2];
            luminance = luminance.toFixed(2);
            pixel = pixel.rgbToHsl();
            pixel.data[2] =  (cdfMap.get(luminance) * (luminanceM.size - 1))/ (luminanceM.size - 1);
            pixel = pixel.hslToRgb();
            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

// Set each pixel in the image to its luminance
Filters.grayscaleFilter = function(image) {
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);
            const luminance = 0.2126 * pixel.data[0] + 0.7152 * pixel.data[1] + 0.0722 * pixel.data[2];
            pixel.data[0] = luminance;
            pixel.data[1] = luminance;
            pixel.data[2] = luminance;

            image.setPixel(x, y, pixel);
        }
    }

    return image;
};

// Adjust each channel in each pixel by a fraction of its distance from the average
// value of the pixel (luminance).
// See: http://www.graficaobscura.com/interp/index.html
Filters.saturationFilter = function(image, ratio) {
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);
            const luminance = 0.2126 * pixel.data[0] + 0.7152 * pixel.data[1] + 0.0722 * pixel.data[2];
            pixel.data[0] = ((1+ratio)*pixel.data[0]) - (luminance*((ratio)));
            pixel.data[1] = ((1+ratio)*pixel.data[1]) - (luminance*((ratio)));
            pixel.data[2] = ((1+ratio)*pixel.data[2]) - (luminance*((ratio)));
            image.setPixel(x, y, pixel);
        }
    }
    return image;
};

// Apply the Von Kries method: convert the image from RGB to LMS, divide by
// the LMS coordinates of the white point color, and convert back to RGB.
Filters.whiteBalanceFilter = function(image, white) {
    white = white.rgbToXyz().xyzToLms();
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            let pixel = image.getPixel(x, y);
            pixel = pixel.rgbToXyz().xyzToLms();
            for (let c = 0; c < 3; c++) {
                pixel.data[c] = pixel.data[c]/white.data[c];
            }
            pixel = pixel.lmsToXyz().xyzToRgb();
            image.setPixel(x, y, pixel);
        }
    }
    return image;
};


// Convolve the image with a gaussian filter.
// NB: Implement this as a seperable gaussian filter
Filters.gaussianFilter = function(image, sigma) {
    // note: this function needs to work in a new copy of the image
    //       to avoid overwriting original pixels values needed later
    // create a new image with the same size as the input image
    let newImg = image.createImg(image.width, image.height);
    let newNewImg = image.createImg(image.width, image.height);
    // the filter window will be [-winR, winR] for a total diameter of roughly Math.round(3*sigma)*2+1;
    const winR = Math.round(sigma * 3);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            let newPixel = new Pixel();
            let totalGaus = 0;
            newPixel.data[0] = 0;
            newPixel.data[1] = 0;
            newPixel.data[2] = 0;
            for (let c = x-winR; c < x+winR; c++) {
                let pixel = image.getPixel(Math.abs(c%image.width),y);
                let gaussian = (Math.exp((-1)*((Math.abs(c%image.width))**2)/(2*(sigma**2))));
                newPixel.data[0] += pixel.data[0] * 1-gaussian;
                newPixel.data[1] += pixel.data[1] * 1-gaussian;
                newPixel.data[2] += pixel.data[2] * 1-gaussian;
                totalGaus += 1-gaussian;
            }

            newPixel.data[0] /= totalGaus;
            newPixel.data[1] /= totalGaus;
            newPixel.data[2] /= totalGaus;
            newPixel.clamp();
            newNewImg.setPixel(x, y, newPixel);
        }
    }

        for (let x = 0; x < image.width; x++) {
            for (let y = 0; y < image.height; y++) {
                let newPixel = new Pixel();
                let totalGaus = 0;
                newPixel.data[0] = 0;
                newPixel.data[1] = 0;
                newPixel.data[2] = 0; 
                for (let c = y-winR; c < y + winR; c++) {
                    let pixel = newNewImg.getPixel(x, Math.abs(c%image.height));
                    let gaussian = (Math.exp((-1)*((Math.abs(c%image.width))**2)/(2*(sigma**2))));
                    newPixel.data[0] += pixel.data[0] * 1-gaussian;
                    newPixel.data[1] += pixel.data[1] * 1-gaussian;
                    newPixel.data[2] += pixel.data[2] * 1-gaussian;
                    totalGaus += 1-gaussian;
                }
    
                newPixel.data[0] /= totalGaus;
                newPixel.data[1] /= totalGaus;
                newPixel.data[2] /= totalGaus;
                newPixel.clamp();
                newImg.setPixel(x, y, newPixel);
            }
    
    }  
    return newImg;
};

/*
* First the image with the edge kernel and then add the result back onto the
* original image.
*/
Filters.sharpenFilter = function(image) {
    let newImg = image.createImg(image.width, image.height);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y< image.height; y++) {
            // deal with corner cases
            let newPixel = new Pixel();
            newPixel.data[0] = 0;
            newPixel.data[1] = 0;
            newPixel.data[2] = 0;
            for (let c = 0; c < 3; c++) {
                newPixel.data[c] += image.getPixel(x-1, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x+1, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x-1, y).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y).data[c] * (9);
                newPixel.data[c] += image.getPixel(x+1, y).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x-1, y+1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y+1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x+1, y+1).data[c] * (-1);
            }
            newImg.setPixel(x, y, newPixel);
        }
    }
    return newImg;
};

/*
* Convolve the image with the edge kernel from class. You might want to define
* a convolution utility that convolves an image with some arbitrary input kernel
*
* For this filter, we recommend inverting pixel values to enhance edge visualization
*/
Filters.edgeFilter = function(image) {
    let newImg = image.createImg(image.width, image.height);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y< image.height; y++) {
            // deal with corner cases
            let newPixel = new Pixel();
            newPixel.data[0] = 0;
            newPixel.data[1] = 0;
            newPixel.data[2] = 0;
            for (let c = 0; c < 3; c++) {
                newPixel.data[c] += image.getPixel(x-1, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x+1, y-1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x-1, y).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y).data[c] * (8);
                newPixel.data[c] += image.getPixel(x+1, y).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x-1, y+1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x, y+1).data[c] * (-1);
                newPixel.data[c] += image.getPixel(x+1, y+1).data[c] * (-1);
                newPixel.data[c] = 1 - newPixel.data[c];
            }
            newImg.setPixel(x, y, newPixel);
        }
    }

    return newImg;

};

// Set a pixel to the median value in its local neighbor hood. You might want to
// apply this seperately to each channel.
Filters.medianFilter = function(image, winR) {
    // winR: the window will be  [-winR, winR];
    let newImg = image.createImg(image.width, image.height);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y< image.height; y++) {
            let pixel = image.getPixel(x,y);
                let nR = [];
                let nG = [];
                let nB = [];
                for (let i = x-winR; i < x+winR; i++) {
                    for (let j = y-winR; j < y+winR; j++) {
                        let pixelNew = image.getPixel(i,j);
                        nR.push(pixelNew.data[0]);
                        nG.push(pixelNew.data[1]);
                        nB.push(pixelNew.data[2]);
                    }
                }
                nR.sort();
                nG.sort();
                nB.sort();
                const length = nR.length;
                if(length%2 != 0) {
                    pixel.data[0] = nR[length/2];
                    pixel.data[1] = nG[length/2];
                    pixel.data[2] = nB[length/2];
                }
                else {
                    pixel.data[0] = (nR[length/2] + nR[length/2 + 1])/2;
                    pixel.data[1] = (nG[length/2] + nG[length/2 + 1])/2;
                    pixel.data[2] = (nB[length/2] + nB[length/2 + 1])/2;
                }
                newImg.setPixel(x, y, pixel);
           
        }
    }
    return newImg;
};

// Apply a bilateral filter to the image. You will likely want to reference
// precept slides, lecture slides, and the assignments/examples page for help.
Filters.bilateralFilter = function(image, sigmaR, sigmaS) {
    // reference: https://en.wikipedia.org/wiki/Bilateral_filter
    // we first compute window size and preprocess sigmaR
    const winR = Math.round((sigmaR + sigmaS) * 1.5);
    sigmaR = sigmaR * (Math.sqrt(2) * winR);

    let newImg = image.createImg(image.width, image.height);
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            let pixel = image.getPixel(x, y);
            let newPixel = new Pixel(0, 0, 0);
            let total = 0;
            // loop for kernel
            for (let curX = -winR; curX < winR; curX++) {
                for (let curY = -winR; curY < winR; curY++) {
                    const depth = (-1)*(Math.pow(curX, 2) + Math.pow(curY, 2))/ (2*Math.pow(sigmaS,2));
                    const currPix = image.getPixel(x+curX, y+curY);
                    const color = (-1)*(255**2)*((pixel.data[0]-currPix.data[0])**2 + (pixel.data[1]-currPix.data[1])**2 + (pixel.data[2]-currPix.data[2])**2)/(2*Math.pow(sigmaR, 2));
                    const weight = Math.exp(depth+color);
                    newPixel.data[0] += currPix.data[0]* weight;
                    newPixel.data[1] += currPix.data[1]* weight;
                    newPixel.data[2] += currPix.data[2]* weight;
                    total+= weight;
                }
            }
            newPixel.data[0] /= total;
            newPixel.data[1] /= total;
            newPixel.data[2] /= total;

            newPixel.clamp();
            newImg.setPixel(x, y, newPixel);
        }
    }

    return newImg;
};

// Conver the image to binary
Filters.quantizeFilter = function(image) {
    // convert to grayscale
    image = Filters.grayscaleFilter(image);

    // use center color
    for (let i = 0; i < image.height; i++) {
        for (let j = 0; j < image.width; j++) {
            const pixel = image.getPixel(j, i);
            for (let c = 0; c < 3; c++) {
                pixel.data[c] = Math.round(pixel.data[c]);
            }
            pixel.clamp();
            image.setPixel(j, i, pixel);
        }
    }
    return image;
};

// To apply random dithering, first convert the image to grayscale, then apply
// random noise, and finally quantize
Filters.randomFilter = function(image) {
    // convert to grayscale
    image = Filters.grayscaleFilter(image);

    for (let i = 0; i < image.height; i++) {
        for (let j = 0; j < image.width; j++) {
            const pixel = image.getPixel(j, i);
            const random = Math.random();
            for (let c = 0; c < 3; c++) {
                pixel.data[c] = pixel.data[c] + (random-0.5)
                pixel.data[c] = Math.round(pixel.data[c]);
            }
            pixel.clamp();
            image.setPixel(j, i, pixel);
        }
    }
    return image;
};

// Apply the Floyd-Steinberg dither with error diffusion
Filters.floydFilter = function(image) {
    // quantize each pixel and compute error for channel. Error is diffused to the neighboring pixels that have not yet been quantized
    // (x+1, y), (x-1,y+1),(x,y+1), and (x+1,y+1), each receiving error diffussion 7/16, 3/16, 5/16, and 1/16
   
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const pixel = image.getPixel(x, y);
            let p1 = new Pixel();
            let p2 = new Pixel();
            let p3 = new Pixel();
            let p4 = new Pixel();
            if (x+1 <= image.width && y+1 <= image.height) {
                for (let c = 0; c < 3; c++) {
                    let orgVal = pixel.data[c];

                    // this is where the gray scale is rounded
                    pixel.data[c] = Math.round(pixel.data[c]);
                    let err = orgVal -pixel.data[c];
        
                    p1.data[c] = image.getPixel(x+1,y).data[c] + (7/16)*err; 
                    p2.data[c]= image.getPixel(x-1,y+1).data[c] + (3/16)*err;
                    p3.data[c] = image.getPixel(x,y+1).data[c] + (5/16)*err;
                    p4.data[c] = image.getPixel(x+1,y+1).data[c] + (1/16)*err;
                    
                }
                p1.clamp();
                p2.clamp();
                p3.clamp();
                p4.clamp();
                pixel.clamp();
                image.setPixel(x, y, pixel);
                image.setPixel(x+1, y, p1);
                image.setPixel(x-1, y+1, p2);
                image.setPixel(x, y+1, p3);
                image.setPixel(x+1, y+1, p4);
            }
        }
    }

    return image;
};

// Apply ordered dithering to the image. We recommend using the pattern from the
// examples page and precept slides.

Filters.orderedFilter = function(image) {
    // convert to gray scale
    image = Filters.grayscaleFilter(image);

    let pattern = [
        [15, 7, 13, 5],
        [3, 11, 1, 9],
        [12, 4, 14, 6],
        [0, 8, 2, 10]
    ];
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x%image.width, y%image.height);
            let i = x % 4;
            let j = y % 4; 

            let err = (pixel.data[0] - Math.floor(pixel.data[0]));
            let threshold = (pattern[i][j] + 1)/(17);
            if (err > threshold) {
                pixel.data[0] = Math.ceil(pixel.data[0]);
                pixel.data[1] = Math.ceil(pixel.data[0]);
                pixel.data[2] = Math.ceil(pixel.data[0]);
            }
            else {
                pixel.data[0] = Math.floor(pixel.data[0]);
                pixel.data[1] = Math.floor(pixel.data[0]);
                pixel.data[2] = Math.floor(pixel.data[0]);
            }
            pixel.clamp();
            image.setPixel(x%image.width, y%image.height, pixel)
        }
    }
    return image;
};

// Implement bilinear and Gaussian sampling (in addition to the basic point sampling).
// This operation doesn't appear on GUI and should be used as a utility function.
// Call this function from filters that require sampling (e.g. scale, rotate)
Filters.samplePixel = function(image, x, y, mode) {
    if (mode === "bilinear") {
        let newPixel = new Pixel(0, 0, 0);
        let a = Math.ceil(x) - x;
        let b = Math.ceil(y) - y;

        let p1 = image.getPixel(Math.floor(x), Math.ceil(y));
        let p2 = image.getPixel(Math.floor(x), Math.floor(y));
        let p3 = image.getPixel(Math.ceil(x), Math.ceil(y));
        let p4 = image.getPixel(Math.ceil(x), Math.floor(y));

        for (let c = 0; c < 3; c++) {
            newPixel.data[c] = p1.data[c]*(a)*(1-b) + p2.data[c]*(a)*(b) + p3.data[c]*(1-a)*(1-b) + p4.data[c]*(1-a)*(b);
        }
        newPixel.clamp();
        return newPixel;
       
    } else if (mode === "gaussian") {

            let newPixel = new Pixel(0, 0, 0);
            let totalGaus = 0;
            for (let c = -1; c < 2; c++) {
                for(let d = -1; d < 2; d++) {
                    let pixel = image.getPixel(x+c,y+d);
                    let gaussian = Math.exp((-1)*Math.pow(c,2)/(4));
                    newPixel.data[0] += pixel.data[0]*gaussian;
                    newPixel.data[1] += pixel.data[1]*gaussian;
                    newPixel.data[2] += pixel.data[2]*gaussian;
                    totalGaus += gaussian;
                }
            }
            newPixel.data[0] /= totalGaus;
            newPixel.data[1] /= totalGaus;
            newPixel.data[2] /= totalGaus;
            newPixel.clamp();
            return newPixel;

    } else {
        // point sampling
        y = Math.max(0, Math.min(Math.round(y), image.height - 1));
        x = Math.max(0, Math.min(Math.round(x), image.width - 1));
        return image.getPixel(x, y);
    }
};

// Translate the image by some x, y and using a requested method of sampling/resampling
Filters.translateFilter = function(image, x, y, sampleMode) {
    // Note: set pixels outside the image to RGBA(0,0,0,0)
    let newImg = image.createImg(image.width, image.height);
    for (let i = 0; i < image.width; i++) {
        for (let j = 0; j < image.height; j++) {
            let bgColor = new Pixel();
            bgColor.data[0] = 0;
            bgColor.data[1] = 0;
            bgColor.data[2] = 0;
            bgColor.data[3] = 0;
            newImg.setPixel(i, j, bgColor);
        }
    }
    for (let i = 0; i < image.width; i++) {
        for (let j = 0; j < image.height; j++) {
            newImg.setPixel(i+x, j+y, Filters.samplePixel(image, i, j, sampleMode));
        }
    }
    return newImg;
};

// Scale the image by some ratio and using a requested method of sampling/resampling
Filters.scaleFilter = function(image, ratio, sampleMode) {
    let newImg = image.createImg(image.width, image.height);
    Filters.fillFilter(newImg, new Pixel("rgba(0,0,0,0)"));
    let width = image.width*ratio;
    let height = image.height*ratio;
    for(let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            newImg.setPixel(x, y, Filters.samplePixel(image, x/ratio, y/ratio, sampleMode));
        }
    }
    return newImg;
};

// Set alpha from luminance
Filters.getAlphaFilter = function(backgroundImg, foregroundImg) {
    for (let i = 0; i < backgroundImg.height; i++) {
        for (let j = 0; j < backgroundImg.width; j++) {
            const pixelBg = backgroundImg.getPixel(j, i);
            const pixelFg = foregroundImg.getPixel(j, i);
            const luminance =
            0.2126 * pixelFg.data[0] + 0.7152 * pixelFg.data[1] + 0.0722 * pixelFg.data[2];
            pixelBg.a = luminance;
            backgroundImg.setPixel(j, i, pixelBg);
        }
    }

    return backgroundImg;
};

// Composites the foreground image over the background image, using the alpha
// channel of the foreground image to blend two images.
Filters.compositeFilter = function(backgroundImg, foregroundImg) {
    // Assume the input images are of the same sizes.
    for (let x = 0; x < backgroundImg.width; x++) {
        for (let y = 0; y < backgroundImg.height; y++) {
            let oldPixel = backgroundImg.getPixel(x, y);
            let newPixel = foregroundImg.getPixel(x, y);
            if (newPixel.a > 0){
                //backgroundImg = Filters.getAlphaFilter(backgroundImg, foregroundImg);
                //oldPixel.a = oldPixel.a*(1-newPixel.a);
                for (let c = 0; c < 3; c++) {
                    oldPixel.data[c] = oldPixel.data[c]*(1-newPixel.a)+newPixel.data[c]*(newPixel.a);
                }
            }
            backgroundImg.setPixel(x, y, oldPixel);
        }
    }
    return backgroundImg;
};


// Morph two images according to a set of correspondance lines
Filters.morphFilter = function(initialImg, finalImg, alpha, sampleMode, linesFile) {
    const lines = Parser.parseJson("images/" + linesFile);

    // The provided linesFile represents lines in a flipped x, y coordinate system
    //  (i.e. x for vertical direction, y for horizontal direction).
    // Therefore we first fix the flipped x, y coordinates here.
    for (let i = 0; i < lines.initial.length; i++) {
        [lines.initial[i].x0, lines.initial[i].y0] = [lines.initial[i].y0, lines.initial[i].x0];
        [lines.initial[i].x1, lines.initial[i].y1] = [lines.initial[i].y1, lines.initial[i].x1];
        [lines.final[i].x0, lines.final[i].y0] = [lines.final[i].y0, lines.final[i].x0];
        [lines.final[i].x1, lines.final[i].y1] = [lines.final[i].y1, lines.final[i].x1];
    }

    let warpedLines = new Array();
    for (let i = 0; i < lines.initial.length; i++) {
        warpedLines.push({
            x0: lines.initial[i].x0 * (1-alpha) + lines.final[i].x0 *alpha,
            y0: lines.initial[i].y0 * (1-alpha) + lines.final[i].y0 *alpha,
            x1: lines.initial[i].x1 * (1-alpha) + lines.final[i].x1 *alpha,
            y1: lines.initial[i].y1 * (1-alpha) + lines.final[i].y1 *alpha,
        })
    }
    const initialWarp = warp(initialImg, lines.initial, warpedLines, 1, sampleMode);
    const finalWarp = warp(finalImg, lines.final, warpedLines, alpha, sampleMode);
    let image = Filters.compositeFilter(initialWarp, finalWarp);
    return image;
};
// helper function for morphing
// takes in image, source lines, and destination lines to create morph
function warp(image, sourceLines, destLines, alpha, sampleMode) {
    let newImg = new Image(image.width, image.height);

    for (let x = 0; x< image.width; x++) {
        for (let y = 0; y< image.height; y++) {
            let weightedSum = 0;
            let xSum = 0;
            let ySum = 0;
            for (let i = 0; i < destLines.length; i++) {
                let curDestLine = destLines[i];
                let curSourceLine = sourceLines[i];
                const denominator = ((curDestLine.x1 - curDestLine.x0)**2 + (curDestLine.y1 - curDestLine.y0)**2);
                const u = ((x - curDestLine.x0)*(curDestLine.x1-curDestLine.x0) + (y - curDestLine.y0)*(curDestLine.y1-curDestLine.y0)) 
                / denominator;
                //perpendicular
                const v = ((x - curDestLine.x0)*(curDestLine.y1-curDestLine.y0)+ (y - curDestLine.y0)*(-curDestLine.x1+curDestLine.x0))
                 / Math.sqrt(denominator);

                let xSource, ySource;
                const denomPrime = Math.sqrt((curSourceLine.x1-curSourceLine.x0)**2 + (curSourceLine.y1 - curSourceLine.y0)**2);
                xSource = curSourceLine.x0 + u * (curSourceLine.x1 - curSourceLine.x0) + (v * (curSourceLine.y1 - curSourceLine.y0)
                / denomPrime);
                // perpendicular
                ySource = curSourceLine.y0 + u * (curSourceLine.y1 - curSourceLine.y0) + (v * (-curSourceLine.x1 + curSourceLine.x0)
                / denomPrime);

                let d;
                if (u < 0) {
                    d = Math.sqrt((x-curDestLine.x0)**2 + (y-curDestLine.y0)**2);
                }
                else if (u > 1) {
                    d = Math.sqrt((x-curDestLine.x1)**2 + (y-curDestLine.y1)**2);
                }
                else {
                    d = Math.abs(v);
                }
                let lengthPQ = Math.sqrt((curSourceLine.x1 - curSourceLine.x0)**2+(curSourceLine.y1-curSourceLine.y0)**2);
                let weight = (lengthPQ**0.5/ (0.01+d))**2;

                xSum += xSource * weight;
                ySum += ySource * weight;
                weightedSum += weight;
            }

            let xAvg, yAvg;

            xAvg = Math.round(xSum/weightedSum);
            if (x <0) {
                xAvg = 0;
            }
            else if (x > image.width) {
                xAvg = image.width - 1;
            }

            yAvg = Math.round(ySum/weightedSum);
            if (y <0) {
                yAvg = 0;
            }
            else if (y > image.height) {
                yAvg = image.height - 1;
            }

            const pixel = Filters.samplePixel(image, xAvg, yAvg, sampleMode);
            pixel.a = alpha;
            newImg.setPixel(x, y, pixel);
        }
    }
    return newImg;
}

Filters.customFilter = function(image, value) {
    image = Filters.grayscaleFilter(image);
    let pattern = [
        [15, 7, 13, 5],
        [3, 11, 1, 9],
        [12, 4, 14, 6],
        [0, 8, 2, 10]
    ];
    for (let x = 0; x < image.width; x++) {
        for (let y = 0; y < image.height; y++) {
            const pixel = image.getPixel(x, y);
            let p1 = new Pixel();
            let p2 = new Pixel();
            let p3 = new Pixel();
            let p4 = new Pixel();
            let i = x % 4;
            let j = y % 4; 
            for (let c = 0; c < 3; c++){
                let orgVal = pixel.data[c];
                pixel.data[c] = Math.round(pixel.data[c]);
                let err = orgVal -pixel.data[c];
                let threshold =  (pattern[i][j] + 1)/(17);

                p1.data[c] = image.getPixel(x+1,y).data[c] + (7/16)*err; 
                p2.data[c]= image.getPixel(x-1,y+1).data[c] + (3/16)*err;
                p3.data[c] = image.getPixel(x,y+1).data[c] + (5/16)*err;
                p4.data[c] = image.getPixel(x+1,y+1).data[c] + (1/16)*err;

                if (err > threshold) {
                    pixel.data[c] = 0;
                    image.setPixel(x, y, pixel);
                }
                else {
                    pixel.data[c] = 1;
                    image.setPixel(x, y, pixel);
                }
            }
            image.setPixel(x+1, y, p1);
            image.setPixel(x-1, y+1, p2);
            image.setPixel(x, y+1, p3);
            image.setPixel(x+1, y+1, p4);
        }
    }
    // ----------- STUDENT CODE END ------------
    //Gui.alertOnce ('orderedFilter is not implemented yet');
    return image;
};

// input value 0.999
Filters.pixelPainting = function(image, value) {
  var w = image.width;
  var h = image.height;
  var ratio_w = 1;
  var ratio_h = 1;

  // square image
  if (w == h) {
    ratio_w = 28;
    ratio_h = 28;
  }
  // vertical image
  else if (w < h) {
    ratio_w = 28;
    ratio_h = 32;
  }
  // horizontal image
  else if (h < w) {
    ratio_w = 32;
    ratio_h = 28;
  }

  var newIm = new Image(w/(w*2*value/ratio_w), h/(h*2*value/ratio_h));
  var x_count = 0;
  var y_count = 0;

for (var x = 0; x < w; x+=w*2*value/ratio_w) {
  y_count=0;
  for (var y = 0; y < h; y+=h*2*value/ratio_h) {
    var mainColor = new Pixel();
    mainColor.data[0] = 0;
    mainColor.data[1] = 0;
    mainColor.data[2] = 0;

    for (var a = x; a < x+w*2*value/ratio_w; a++) {
      for (var b = y; b < y+h*2*value/ratio_h;b++) {
        // gather the average color of all pixels in a small square
        // then set all the pixels in this square into the same color
        let pixelColor = image.getPixel(a, b);
        mainColor.data[0] += pixelColor.data[0]/((w*2*value/ratio_w)*(h*2*value/ratio_h));
        mainColor.data[1] += pixelColor.data[1]/((w*2*value/ratio_w)*(h*2*value/ratio_h));
        mainColor.data[2] += pixelColor.data[2]/((w*2*value/ratio_w)*(h*2*value/ratio_h));
      }
    }
    for (var a = x; a < x+w*2*value/ratio_w; a++) {
      for (var b = y; b < y+w*2*value/ratio_h; b++) {
        image.setPixel(a, b, mainColor);
      }
    }
    // newIm.setPixel(x_count, y_count, mainColor);
    y_count+=1;
  }
 x_count+=1;
}
// return newIm;
return image;
}
