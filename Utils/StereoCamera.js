function StereoCamera(
        Convergence,
        EyeSeparation,
        AspectRatio,
        FOV,
        NearClippingDistance,
        FarClippingDistance
    ) {
    this.mConvergence = Convergence;
    this.mEyeSeparation = EyeSeparation;
    this.mAspectRatio = AspectRatio;
    this.mFOV = FOV * Math.PI / 180.0;
    this.mNearClippingDistance = NearClippingDistance;
    this.mFarClippingDistance = FarClippingDistance;

    this.applyLeftFrustum = function() {
        let top, bottom, left, right;
        let a, b, c;

        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = - top;

        a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        b = a - this.mEyeSeparation / 2;
        c = a + this.mEyeSeparation / 2;

        left = (-b * this.mNearClippingDistance) / this.mConvergence;
        right = (c * this.mNearClippingDistance) / this.mConvergence;

        return m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
    }

    this.applyRightFrustum = function() {
        let top, bottom, left, right;
        let a, b, c;

        top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        bottom = - top;

        a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        b = a - this.mEyeSeparation / 2;
        c = a + this.mEyeSeparation / 2;

        left = (-c * this.mNearClippingDistance) / this.mConvergence;
        right = (b * this.mNearClippingDistance) / this.mConvergence;

        return m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
    }
}