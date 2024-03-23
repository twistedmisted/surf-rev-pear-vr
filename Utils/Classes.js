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