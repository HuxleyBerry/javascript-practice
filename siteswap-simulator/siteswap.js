const HEIGHT = 600;
const WIDTH = 600;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let gravitySlider = document.getElementById("gravity-slider");
let beatSlider = document.getElementById("beat-slider");
let siteswapButton = document.getElementById("siteswap-button");

let animationOngoing = false;
let startingTime;
let globalJuggler;
let globalSiteswap;
let globalSync;

let beatLength; // length in milliseconds
let gravity;

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const asyncExamples = ["534","12345","441","3","4","5","6","7","744","633","1357","51","17","53","423","525","50505","5551","7131","561","4453","612","73","312","531","61616","663","5241","5313","5524","7333","7571","45141","52512","56414"];
const syncExamples = ["(2x,4x)","(4,2x)(2x,4)","(4,4)","(4,4)(4x,0)(4,4)(0,4x)","(4,6x)(2x,4)","(4x,2x)","(4x,2x)(4,2x)(2x,4x)(2x,4)","(4x,4x)","(4x,6)(6,4x)","(6,4x)(4x,2)","(6x,2x)","(6x,2x)(2x,6x)","(6x,4)(4,2x)(4,6x)(2x,4)","(6x,4)(4,6x)","(6x,4x)","(6x,6x)(2x,2x)","(2x,2x)","(8,2x)(4,2x)(2x,8)(2x,4)","(4,4x)(4x,4)"];
const multiplexExamples = ["[54]24","[43]1421","4[43]1","[32]","[43]23"];
const examples = asyncExamples.concat(syncExamples, multiplexExamples);


function mod(n, m) {
    return ((n % m) + m) % m;
}

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

function drawBall(juggler, startingHand, ballThrow, progress) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    var x, y, travelDist, beats;
    if (ballThrow < 0) { //using negative integers to indicate "forced-crossing" throws
        beats = -ballThrow;
        travelDist = juggler.crossingTravelDist;
    } else {
        beats = ballThrow;
        if (beats%2 == 1){
            travelDist = juggler.crossingTravelDist;
        } else {
            travelDist = -juggler.sameTravelDist;
        }
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

function checkThrow(ballThrow, multiplexAllowed, sync) { 
    // checks if a string is a valid representation of a single-handed throw. 
    // returns an empty array if invalid
    if (ballThrow[0] == "[") { //multiplex
        if (!multiplexAllowed || ballThrow[ballThrow.length - 1] != "]") {
            return [];
        } else {
            let throwsList = [];
            for (let i = 1; i < ballThrow.length-1; i++) { //start at 1 and end at length-1 to ignore the square brackets
                let res;
                if (ballThrow[i+1] == "x") {
                    res = checkThrow(ballThrow.slice(i,i+2), false, sync)[0];
                    i++; //skip the "x"
                } else {
                    res = checkThrow(ballThrow[i], false, sync)[0];
                }
                if (res == -1) {
                    return [];
                } else {
                    throwsList.push(res);
                }
            }
            return throwsList;
        }
    } else { //normal throw
        if (ballThrow.length == 1) {
            let index = alphabet.indexOf(ballThrow);
            if (index != -1 && (!sync || index%2 == 0)) { //sync throws must be an even number of beats);
                return [index];
            }
        } else if (sync && ballThrow.length == 2 && ballThrow[1] == "x" && alphabet.includes(ballThrow[0]) ) {
            let index = alphabet.indexOf(ballThrow[0]);
            if (index%2 == 0 && index > 0) { //crossing sync throws must be an even nonzero number of beats
                return [-1*index]; // negative numbers are used to indicate crossing throws
            }
        } 
        return [];
    }
}


function parseSiteswap(siteswap) { //returns a list of all the throws, or an empty list if the siteswap string is invalid
    if (siteswap.startsWith("(")) { //synchronous
        let pairs = siteswap.split("(");
        let numList = [];
        for (let i = 1; i < pairs.length; i++) {
            let splitPair = pairs[i].slice(0,-1).split(",")
            if (splitPair.length != 2) {
                return [];
            } else {
                let throw1 = checkThrow(splitPair[0], true, true);
                let throw2 = checkThrow(splitPair[1], true, true);
                if (throw1 != [] && throw2 != []) {
                    numList.push(throw1);
                    numList.push(throw2);
                } else {
                    return [];
                }
            }
        }
        if (checkSiteswap(numList, true)) {
            return numList;
        } else {
            return [];
        }
    } else { //asynchronous
        let numList = [];
        for (let i = 0; i < siteswap.length; i++) {
            let ballThrow = siteswap[i];
            if (ballThrow === "[") { //dealing with a multiplex
                let closingIndex = siteswap.indexOf("]",i);
                ballThrow = siteswap.slice(i,closingIndex+1);
                i = closingIndex;
            }
            let parsedThrow = checkThrow(ballThrow, true, false);
            if (parsedThrow != []) {
                numList.push(parsedThrow);
            }
            else {
                return [];
            }
        }
        if (checkSiteswap(numList, false)) {
            return numList;
        } else {
            return [];
        }
    }
}

//TODO: fix checking for sync siteswaps. E.g. (4,2)(2,4)
function checkSiteswap(siteswap, sync) { 
    let beats = siteswap.length;
    if (sync && beats%2 == 1) throw "Error: somehow sync siteswap has odd number of throws!";
    let catchesEachBeat = Array(beats).fill(0);
    for (let i = 0; i < beats; i++) {
        siteswap[i].forEach(ball => {
            catchesEachBeat[(i+Math.abs(ball))%beats] += 1;
        });
        if (sync) {
            siteswap[i+1].forEach(ball => {
                catchesEachBeat[(i+Math.abs(ball))%beats] += 1;
            });
            i++;
        }
    }
    for (let i = 0; i < beats; i++) {
        if (sync) {
            if (siteswap[i].length + siteswap[i+1].length !== catchesEachBeat[i]) {
                return false;
            }
            i++;
        } else {
            if (siteswap[i].length !== catchesEachBeat[i]) {
                return false;
            }
        }
    }
    return true;
}

function getMaxThrow(siteswap) {
    let flattened = [].concat(...siteswap);
    let positiveSiteswap = flattened.map(x => Math.abs(x));
    return Math.max(...positiveSiteswap);
}

function calcIdealWorkingHeight(siteswap) {
    let maxThrow = getMaxThrow(siteswap);
    return Math.min(590,(10-HEIGHT)/(-0.25 + (gravity*beatLength)*((maxThrow-0.5)/2)*(-maxThrow/2 + 0.25)));
}

function showInvalidSiteSwap() {
    ctx.clearRect(0,0,WIDTH,HEIGHT)
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText("Invalid Siteswap", WIDTH*0.5 - ctx.measureText("Invalid Siteswap").width*0.5, HEIGHT*0.5);
}

siteswapButton.onclick = () => {
    startingTime = performance.now();
    let inputSiteswap = document.getElementById("siteswap-input").value;
    globalSync = inputSiteswap.startsWith("(");
    globalSiteswap = parseSiteswap(inputSiteswap);
    globalJuggler = getJuggler(calcIdealWorkingHeight(globalSiteswap));
    if (globalSiteswap.length != 0) {
        animationOngoing = true;
        window.requestAnimationFrame(doStuff);
    } else {
        animationOngoing = false;
        showInvalidSiteSwap();
    }
};

beatSlider.onchange = () => {
    let newBeatLength = beatSlider.value * 100;
    document.getElementById("beat-text").textContent = "Beat length: " + newBeatLength;
    beatLength = newBeatLength;
    siteswapButton.onclick();
};
beatSlider.onchange();
gravitySlider.onchange = () => {
    let newGravity = gravitySlider.value * 0.0002;
    document.getElementById("gravity-text").textContent = "Gravity: " + (newGravity*1000).toPrecision(2);
    gravity = newGravity;
    siteswapButton.onclick();
};
gravitySlider.onchange();

document.getElementById("example-button").onclick = () => {
    document.getElementById("siteswap-input").value = examples[Math.floor(Math.random()*examples.length)]
    siteswapButton.onclick();
};

function getRotation(beats,start) {
    if ((beats+start)%2 < 1.5) {
        return 2*(((beats+start)%2))*Math.PI/3;
    } else {
        return 2*(((beats+start)%2))*Math.PI;
    }
}

function drawAsyncSiteswap(juggler, siteswap, beats) {
    let maxThrowSize = getMaxThrow(siteswap); //amount of beats we need to backtrack
    for (let i = 0; i < maxThrowSize; i++) {
        let hand, throwHeights, progress;
        if ((Math.floor(beats)-i)%2 != 0) {
            hand = "left";
        } else {
            hand = "right";
        }
        progress = beats%1 + i;
        throwHeights = siteswap[mod(Math.floor(beats)-i-1,siteswap.length)];
        throwHeights.forEach((height) => {
            if (progress <= height) {
                drawBall(juggler, hand, height, progress);					
            }
        });
    }
}

function drawSyncSiteswap(juggler, siteswap, beats) {
    if (siteswap.length%2 != 0) throw "Error: somehow sync siteswap has odd number of throws!";
    let positiveSiteswap = siteswap.map(x => Math.abs(x));
    let maxThrowSize = Math.max(...positiveSiteswap); //amount of beats we need to backtrack
    for (let i = 0; i < maxThrowSize; i += 2) {
        let progress = beats%2 + i;
        let leftThrowHeights = siteswap[mod(Math.floor(beats*0.5)*2-i-1,siteswap.length)];
        let rightThrowHeights = siteswap[mod(Math.floor(beats*0.5)*2-i-2,siteswap.length)];
        leftThrowHeights.forEach((height) => {
            if (progress <= Math.abs(height)) {
                drawBall(juggler, "left", height, progress);					
            }
        });
        rightThrowHeights.forEach((height) => {
            if (progress <= Math.abs(height)) {
                drawBall(juggler, "right", height, progress);					
            }
        });
    }
}

function doStuff(timeStamp) {
    if (animationOngoing) {
        ctx.clearRect(0,0,WIDTH,HEIGHT)
        let currentTime = timeStamp-startingTime;
        let beats = currentTime/beatLength;
        let leftRotation, rightRotation;
        if (globalSync) {
            leftRotation = getRotation(beats,1.5);
            rightRotation = getRotation(beats,1.5);
        } else {
            leftRotation = getRotation(beats,0.5);
            rightRotation = getRotation(beats,1.5);
        }
        drawPerson(globalJuggler,leftRotation,rightRotation);
        if (globalSync) {
            drawSyncSiteswap(globalJuggler, globalSiteswap, beats)
        } else {
            drawAsyncSiteswap(globalJuggler, globalSiteswap, beats)
        }
        window.requestAnimationFrame(doStuff);
    }
}