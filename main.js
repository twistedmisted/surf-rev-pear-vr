'use strict';

class Point {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    transformVector() {
        return [this.x, this.y, this.z];
    }
}

class UVPoint {
    constructor(u, v) {
        this.u = u;
        this.v = v;
    }

    transformVector() {
        return [this.u, this.v];
    }
}

class SurfaceData {
    constructor(vertexList, texturePoints) {
        this.vertexList = vertexList;
        this.texturePoints = texturePoints;
    }
}

let gl;                         // The webgl context.
let surface;                    // A surface model
let rotationPointModel;         // A model for rotation point
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let texturePoint;

let parameters = {};

const maxAngle = 2 * Math.PI;

function initParameters() {
    texturePoint = { x: 0, y: 0 };

    parameters = {
        a: 10,
        b: 4,
        zStep: 0.1,
        angleStep: 10,
        rotTexAngleDeg: 0
    };

    for (let key in parameters) {
        document.getElementById(key).value = parameters[key];
    }
}

// Lambda functions to calculate vertex of 'Surface of Revolution of a "Pear"'
const X = (rZ, angle) => rZ * Math.sin(angle);
const Y = (rZ, angle) => rZ * Math.cos(angle);
const RZ = (z) => (z * Math.sqrt(z * (parameters.a - z))) / parameters.b

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();
    this.verticesLength = 0;
    this.textureLength = 0;
    
    this.BufferData = function(surfData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfData.vertexList), gl.STREAM_DRAW);

        this.verticesLength = surfData.vertexList.length / 3;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfData.texturePoints), gl.STREAM_DRAW);

        this.textureLength = surfData.texturePoints.length / 2;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
   
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexture, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexture);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.verticesLength);
    }

    this.PointBuffer = function(pointData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointData), gl.DYNAMIC_DRAW);
    }

    this.DrawPoint = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.drawArrays(gl.POINTS, 0, 1);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribTexture = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    
    this.iTMU = -1;

    this.iTranslatePoint = -1;
    this.iTexturePoint = -1;
    this.iAngleRad = -1;
    
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

/* Draws a 'Surface of Revolution "Pear"' */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.orthographic(-20, 20, -20, 20, -20, 20);
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
       
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    gl.uniform1i(shProgram.iTMU, 0);

    gl.uniform2fv(shProgram.iTexturePoint, [texturePoint.x, texturePoint.y]);
    gl.uniform1f(shProgram.iAngleRad, deg2rad(parameters.rotTexAngleDeg));
    
    surface.Draw();
    
    let translationForUserPoint = calcVertPoint(mapBack(texturePoint.x, parameters.a), mapBack(texturePoint.y, maxAngle));

    gl.uniform3fv(shProgram.iTranslatePoint, translationForUserPoint.transformVector());
    gl.uniform1f(shProgram.iAngleRad, -1.0);

    rotationPointModel.DrawPoint();
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
    parameters.a = getValueByElementId('a');
    parameters.b = getValueByElementId('b');
    parameters.zStep = getValueByElementId('zStep');
    parameters.angleStep = getValueByElementId('angleStep');
    parameters.rotTexAngleDeg = getValueByElementId('rotTexAngleDeg');
}

/**
 * Updates buffer data and draws a surface.
 */
function updateDataAndDraw() {
    surface.BufferData(CreateSurfaceData());
    draw();
}

/**
 * Gets value from UI by its element id.
 */
function getValueByElementId(elementId) {
    const value = document.getElementById(elementId).value;
    if (value) {
        return parseFloat(value);
    }
    document.getElementById(elementId).value = parameters[elementId];
    return parameters[elementId];
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

function LoadTexture() {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = "https://raw.githubusercontent.com/twistedmisted/surf-rev-pear/CGW/texture/water.png";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        draw();
    }
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vVertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    
    shProgram.iAttribTexture             = gl.getAttribLocation(prog, "texCoord");
    shProgram.iTMU                       = gl.getUniformLocation(prog, "tmu");

    shProgram.iTranslatePoint            = gl.getUniformLocation(prog, 'pTranslate');
    shProgram.iTexturePoint              = gl.getUniformLocation(prog, 'pTexture');
    shProgram.iAngleRad                  = gl.getUniformLocation(prog, 'angleRad');

    surface = new Model('Surface of Revolution "Pear"');
    initParameters();
    LoadTexture();
    setBufferData(surface);

    rotationPointModel = new Model('Rotation Point');
    rotationPointModel.PointBuffer([0.0, 0.0, 0.0]);

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

    draw();
}

window.onkeydown = (key) => {
    switch (key.keyCode) {
        case 87:
            texturePoint.x -= 0.01;
            break;
        case 83:
            texturePoint.x += 0.01;
            break;
        case 65:
            texturePoint.y += 0.01;
            break;
        case 68:
            texturePoint.y -= 0.01;
            break;
    }
    // Check if point is on the surface
    texturePoint.x = Math.max(0.001, Math.min(texturePoint.x, 0.999))
    texturePoint.y = Math.max(0.001, Math.min(texturePoint.y, 0.999))
    draw();
}