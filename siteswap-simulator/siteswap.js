const HEIGHT = 600;
const WIDTH = 600;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let gravitySlider = document.getElementById("gravity-slider");
let beatSlider = document.getElementById("beat-slider");
let animationOngoing = false;

let beatLength; // length in milliseconds
let gravity;

const alphabet = "abcdefghijklmnopqrstuvwxyz";

function getJuggler(workingHeight) {
    return {
        headSize: workingHeight*0.15,
        headY: HEIGHT-workingHeight*0.85,
        shoulderX: WIDTH*0.5 - workingHeight*0.2,
        shoulderY: HEIGHT-workingHeight*0.6,
        hipX: WIDTH*0.5 - workingHeight*0.1,
        hipY: HEIGHT-workingHeight*0.1,
        elbowX: WIDTH*0.5 - workingHeight*0.3,
        elbowY: HEIGHT-workingHeight*0.2,

        ballSize: workingHeight*0.05,
        crossingTravelDist: workingHeight*0.6,
        sameTravelDist: workingHeight*0.3,
        armLength: workingHeight*0.15,
        height: workingHeight,
        handX: (rot) => {
            return WIDTH*0.5 - workingHeight*(0.3-0.15*Math.cos(rot));
        },
        handY: (rot) => {
            return HEIGHT-workingHeight*(0.2+Math.sin(rot)*0.15);
        }
    };
}

function drawPerson(j, leftRotation, rightRotation) {
    // draw head
    ctx.beginPath();
    ctx.arc(WIDTH*0.5, j.headY, j.headSize, 0, 2 * Math.PI);
    // draw body
    ctx.moveTo(j.shoulderX, j.shoulderY);
    ctx.lineTo(WIDTH - j.shoulderX, j.shoulderY);
    ctx.lineTo(WIDTH - j.hipX, j.hipY);
    ctx.lineTo(j.hipX, j.hipY);
    ctx.closePath();
    // draw arms
    ctx.moveTo(j.shoulderX, j.shoulderY);
    ctx.lineTo(j.elbowX,j.elbowY);
    ctx.lineTo(j.handX(leftRotation),j.handY(leftRotation));
    ctx.moveTo(WIDTH - j.shoulderX, j.shoulderY);
    ctx.lineTo(WIDTH - j.elbowX,j.elbowY);
    ctx.lineTo(WIDTH - j.handX(rightRotation),j.handY(rightRotation));
    ctx.stroke();
}

function drawBall(juggler, startingHand, beats, progress) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    var x, y, travelDist;
    if (beats%2 == 1){
        travelDist = juggler.crossingTravelDist;
    } else {
        travelDist = -juggler.sameTravelDist;
    }
    if (progress <= 0.5) {
        x = juggler.handX(progress*2 * Math.PI - Math.PI);
        y = juggler.handY(progress*2 * Math.PI - Math.PI);
    } else {
        x = juggler.elbowX + juggler.armLength + (progress - 0.5)/(beats-0.5)*(travelDist);
        y = juggler.elbowY + juggler.height*(gravity*beatLength)*(progress - 0.5)*(progress-beats);
    }
    if (startingHand === "right") {
        x = WIDTH-x;
    }
    ctx.arc(x,y,juggler.ballSize, 0, 2 * Math.PI);
    ctx.fill();
}

function checkSiteswap() {
    let text = document.getElementById("siteswap-input").value;
    let total = 0;
    let numList = []
    for (let i = 0; i < text.length; i++) {
        let index = alphabet.indexOf(text[i])
        let newNum = parseInt(text[i]);
        if (index != -1) {
            newNum = 10+index;
        }
        else if (isNaN(newNum)) {
            return [];
        }
        total += newNum;
        numList.push(newNum);
    }
    // perform vanilla siteswap test
    let sums = []
    for (let i = 0; i < numList.length; i++) {
        let sum = (numList[i]+i)%numList.length
        if (sums.includes(sum)) {
            return []; // two balls are landing in the same hand at the same time
        } else {
            sums.push(sum);
        }
    }
    if (total%text.length == 0) {
        return numList;
    } else {
        return [];
    }
}

function calcIdealWorkingHeight(maxThrow) {
    return Math.min(590,(10-HEIGHT)/(-0.25 + (gravity*beatLength)*((maxThrow-0.5)/2)*(-maxThrow/2 + 0.25)));
}

function showInvalidSiteSwap() {
    ctx.clearRect(0,0,WIDTH,HEIGHT)
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText("Invalid Siteswap", WIDTH*0.5 - ctx.measureText("Invalid Siteswap").width*0.5, HEIGHT*0.5);
}

document.getElementById("siteswap-button").onclick = () => {
    startingTime = performance.now();
    siteswap = checkSiteswap();
    let juggler = getJuggler(calcIdealWorkingHeight(Math.max(...siteswap)));
    if (siteswap.length != 0) {
        animationOngoing = true;
        requestId = window.requestAnimationFrame((timeStamp) => {
            doStuff(juggler, siteswap, timeStamp, startingTime);
        });
    } else {
        animationOngoing = false;
        showInvalidSiteSwap();
    }
};

beatSlider.onchange = () => {
    let newBeatLength = beatSlider.value * 100;
    document.getElementById("beat-text").textContent = "Beat length: " + newBeatLength;
    beatLength = newBeatLength;
    document.getElementById("siteswap-button").onclick();
};
beatSlider.onchange();
gravitySlider.onchange = () => {
    let newGravity = gravitySlider.value * 0.0002;
    document.getElementById("gravity-text").textContent = "Gravity: " + (newGravity*1000).toPrecision(2);
    gravity = newGravity;
    document.getElementById("siteswap-button").onclick();
};
gravitySlider.onchange();

function getRotation(beats,start) {
    if ((beats+start)%2 < 1.5) {
        return 2*(((beats+start)%2))*Math.PI/3;
    } else {
        return 2*(((beats+start)%2))*Math.PI;
    }
}

function drawSiteswap(juggler, siteswap, beats) {
    let maxThrowSize = Math.max(...siteswap); //amount of beats we need to backtrack
    for (var i = 0; i < maxThrowSize; i++) {
        let hand, throwHeight, progress;
        if ((Math.floor(beats)-i)%2 != 0) {
            hand = "left";
        } else {
            hand = "right";
        }
        throwHeight = siteswap[(siteswap.length+Math.floor(beats)-i)%siteswap.length];
        progress = beats-Math.floor(beats)+i
        if (progress <= throwHeight) {
            drawBall(juggler, hand, throwHeight, progress);					
        }
    }
}

function doStuff(juggler, siteswap, timeStamp, startingTime) {
    if (animationOngoing) {
        ctx.clearRect(0,0,WIDTH,HEIGHT)
        let currentTime = timeStamp-startingTime;
        let beats = currentTime/beatLength;
        let leftRotation = getRotation(beats,0.5);
        let rightRotation = getRotation(beats,1.5);
        drawPerson(juggler,leftRotation,rightRotation);
        drawSiteswap(juggler, siteswap, beats)
        window.requestAnimationFrame((timeStamp) => {
            doStuff(juggler, siteswap, timeStamp, startingTime);
        });
    }
}