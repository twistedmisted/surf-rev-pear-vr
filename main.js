'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let webCamSurface;              // A surface for web camera with zero parallax
let stereoCam;                  // Object holding stereo camera calculation parameters
let rotationPointModel;         // A model for rotation point
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let surfTexture;                // Holds texture for main sufrace
let webCamTexture;              // Holds texture from web cam

let video;                      // Holds video from webcam for texture

let parameters = {};

const maxAngle = 2 * Math.PI;

function initParameters() {
    parameters = {
        a: 1,
        b: 0.5,
        zStep: 0.01,
        angleStep: 100,
        nearClippingDistance: 8,
        farClippingDistance: 20000,
        eyeSeparation: 1,
        FOV: Math.PI * 3,
        convergence: 50
    };

    for (let key in parameters) {
        let element = document.getElementById(key);
        if (element) {
            element.value = parameters[key];
        }
    }
}

// Lambda functions to calculate vertex of 'Surface of Revolution of a "Pear"'
const X = (rZ, angle) => rZ * Math.sin(angle);
const Y = (rZ, angle) => rZ * Math.cos(angle);
const RZ = (z) => (z * Math.sqrt(z * (parameters.a - z))) / parameters.b

/* Draws a 'Surface of Revolution "Pear"' */
function draw() { 
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.orthographic(-20, 20, -20, 20, -20, 20);
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.0);
    let translateToPointZero = m4.translation(0, 0, -20);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
    let matAccum2 = m4.multiply(rotateToPointZero, m4.identity());
    let matAccum3 = m4.multiply(translateToPointZero, matAccum2);
    let modelViewProjection = m4.multiply(projection, matAccum3);

    let matrLeftFrustum = stereoCam.applyLeftFrustum();
    let matrRightFrustum = stereoCam.applyRightFrustum();

    let translateLeftEye = m4.translation(-stereoCam.mEyeSeparation / 2, 0, 0);
    let translateRightEye = m4.translation(stereoCam.mEyeSeparation / 2, 0, 0);

    drawWebCamera(projection);

    gl.uniform1i(shProgram.iTMU, 0);
    gl.bindTexture(gl.TEXTURE_2D, surfTexture);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.multiply(modelViewProjection, translateLeftEye));
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, m4.multiply(matrLeftFrustum, matAccum1));

    // First pass for left eye, drawing to red component only
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(true, false, false, false); // setup only red component

    surface.Draw();

    // Second pass for left eye, drawing to blue+green components only
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, m4.multiply(modelViewProjection, translateRightEye));
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, m4.multiply(matrRightFrustum, matAccum1));

    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, true, true, false); // setup only blue+green components

    surface.Draw();

    gl.colorMask(true, true, true, true); // reset all RGB components
}

/**
 * Draws a surface with webcam video texture
 */
function drawWebCamera(projection) {
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniform1i(shProgram.isCamera, true);

    gl.bindTexture(gl.TEXTURE_2D, webCamTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    webCamSurface.DrawTriangles();
}

/**
 * Draws a surface with defualt values.
 */
function drawDefault() {
    initParameters();
    updateDataAndDraw();
    
}

/**
 * Draws a surface with parameters entered by user on UI.
 */
function redraw() {
    setNewParameters();
    updateDataAndDraw();
}

/**
 * Gets parameters from UI and updates it on program config.
 */
function setNewParameters() {
    for (let key in parameters) {
        let element = document.getElementById(key);
        if (element) {
            parameters[key] = parseFloat(element.value);
        }   
    }
}

/**
 * Updates buffer data and draws a surface.
 */
function updateDataAndDraw() {
    stereoCam = new StereoCamera(parameters.convergence, parameters.eyeSeparation, 850 / 850, parameters.FOV, parameters.nearClippingDistance, parameters.farClippingDistance);
    surface.BufferData(CreateSurfaceData());
    draw();
}

/**
 * Creates surface data by explicit equation of 'Surface of Revolution "Pear"' 
 */
function CreateSurfaceData() {
    let vertexList = [];
    let texturePoints = [];
    
    let angleStep = Math.PI / parameters.angleStep;

    for (let z = 0; z <= (parameters.a - parameters.zStep).toFixed(2); z = +(parameters.zStep + z).toFixed(2)) {
        for (let angle = 0; angle <= maxAngle - angleStep; angle += angleStep) {
            let u1 = z;
            let v1 = angle;
            let u2 = z;
            let v2 = angle + angleStep;
            let u3 = +(parameters.zStep + z).toFixed(2);
            let v3 = angle;
            let u4 = +(parameters.zStep + z).toFixed(2);
            let v4 = angle + angleStep;

            let p1 = calcVertPoint(u1, v1);
            let p2 = calcVertPoint(u2, v2);
            let p3 = calcVertPoint(u3, v3);
            let p4 = calcVertPoint(u4, v4);

            vertexList.push(...p1.transformVector(), ...p2.transformVector(), ...p3.transformVector(), ...p4.transformVector());

            let uv1 = calcUVPoint(u1, parameters.a, v1, maxAngle);
            let uv2 = calcUVPoint(u2, parameters.a, v2, maxAngle);
            let uv3 = calcUVPoint(u3, parameters.a, v3, maxAngle);
            let uv4 = calcUVPoint(u4, parameters.a, v4, maxAngle);

            texturePoints.push(...uv1.transformVector(), ...uv2.transformVector(), ...uv3.transformVector(), ...uv4.transformVector());
        }
    }

    return new SurfaceData(vertexList, texturePoints);
}

function calcVertPoint(z, angle) {
    let rZ = RZ(z);
    let x = X(rZ, angle);
    let y = Y(rZ, angle);
    return new Point(x, y, z);
}

function calcUVPoint(u, uMAx, v, vMax) {
    return new UVPoint(map(u, uMAx), map(v, vMax));
}

function map(val, max) {
    return val / max;
}

function mapBack(val, max) {
    return val * max;
}

function LoadSurfaceTexture() {
    surfTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, surfTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = "https://raw.githubusercontent.com/twistedmisted/surf-rev-pear-vr/PA1/texture/tree_bark_0.jpg";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, surfTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        draw();
    }
}

function LoadWebCamTexture() {
    webCamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webCamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vVertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    
    shProgram.iAttribTexture             = gl.getAttribLocation(prog, "texCoord");
    shProgram.iTMU                       = gl.getUniformLocation(prog, "tmu");

    shProgram.isCamera                   = gl.getUniformLocation(prog, "isCamera");

    surface = new Model('Surface of Revolution "Pear"');
    initParameters();
    LoadSurfaceTexture();
    setBufferData(surface);

    // Stereo camera for negative parallax
    stereoCam = new StereoCamera(parameters.convergence, parameters.eyeSeparation, 850 / 850, parameters.FOV, parameters.nearClippingDistance, parameters.farClippingDistance);

    // A model for web cam video with negative parallax on background
    webCamSurface = new Model("Web Camera Surface");
    // Loading triangles data to draw surface on full canvas 
    webCamSurface.BufferData(new SurfaceData(
        [
            -20.0, 20.0, 0.0, 
            -20.0, -20.0, 0.0, 
            20.0, -20.0, 0.0,
            20.0, -20.0, 0.0, 
            20.0, 20.0, 0.0,
            -20.0, 20.0, 0.0, 
        ],
        [1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]
    ));

    gl.enable(gl.DEPTH_TEST);
}

function setBufferData(surface) {
    surface.BufferData(CreateSurfaceData());
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        setupWebCam();
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    updateSurfaces();
}

function setupWebCam() {
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    window.vid = video;

    // Looking for available web camera
    let constraints = {video: true, audio: false};
    navigator.getUserMedia(constraints, function (stream) {
        video.srcObject = stream;
    }, function (e) {
        console.error('Can\'t find a Web camera', e);
    });

    // Loading video from web cam as texture
    LoadWebCamTexture();
}

function updateSurfaces() {
    draw();
    window.requestAnimationFrame(updateSurfaces)
}