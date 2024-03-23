function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribTexture = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    
    this.iTMU = -1;

    this.isCamera = false;
    
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}