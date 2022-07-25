class MathHelper {
	constructor() {}
	toDegree(radians) {
    return radians * 180 / Math.PI;
	}
	toRadian(degrees) {
    return degrees * Math.PI / 180;
	}
	degAcos(dot) {
	return this.toDegree(Math.acos(dot));
	}
}

/**
 * Vector2 class for instances
 */
export class Vector2{
	constructor(x, y) {
		if (Number.isNaN(x)) this.x = 0
		else this.x = x;
		if (Number.isNaN(y)) this.y = 0
		else this.y = y;
	}
	
	clone() {
		return new Vector2(this.x, this.y);
	}
	
	add(second) {
		return new Vector2(this.x + second.x, this.y + second.y);
	}
	
	subtract(second) {
		return new Vector2(this.x - second.x, this.y - second.y);
	}
	
	multiply(num) {
		return new Vector2(this.x * num, this.y * num);
	}
	
	divide(num) {
		return new Vector2(this.x / num, this.y / num);
	}
	
	inverse() {
		return new Vector2(-this.x, -this.y);
	}
	
	dot(second) {
		return (this.x * second.x) + (this.y * second.y);
	}
	
	magnitude() {
		return Math.sqrt(this.dot(this));
	}
	
	resize(len) {
		let factor = len / this.magnitude();
		return this.multiply(factor);
	}
	
	isZero(precision) {
		if (precision === undefined) {
			return ((this.x == 0) && (this.y == 0))
		} else {
			let xIsZero = (this.x < precision) && (this.x > -precision);
			let yIsZero = (this.y < precision) && (this.y > -precision);
			return xIsZero && yIsZero;
		}
	}
	
	equalTo(second, precision) {
		return this.subtract(second).isZero(precision);
	}
	
	normalize() {
		let magnitude = this.magnitude();
		if (magnitude == 0) return Vector2(0, 0)
		else return this.divide(magnitude);
	}
	
	cross(second) {
		return (this.x * second.y) - (second.x * this.y);
	}
	
	distance(second) {
		return this.subtract(second).magnitude();
	}
	
	rotateRadian(radian) {
		let result = new Vector2(0, 0);
		
		result.x = this.x * Math.cos(radian) - this.y * Math.sin(radian);
		result.y = this.y * Math.cos(radian) + this.x * Math.sin(radian);
		
		return result;
	}
	
	rotateDegree(degree) {
		let helper = new MathHelper();
		return this.rotateRadian(helper.toRadian(degree));
	}
	
	// angle in [0, 180] degree range
	angleUnsigned(second) {
		let helper = new MathHelper();
		
		return helper.degAcos(this.normalize().dot(second.normalize()));
	}
	
	// angle in [-180, 180] degree range
	angleSigned(second) {
		let angle = this.angleUnsigned(second);
		let sign = Math.sign(this.normalize().cross(second.normalize()));
		
		return angle * sign;
	}
	
	// angle in [0, 360] degree range
	angle360(second) {
		let angle = this.angleSigned(second);
		if (angle < 0) angle = 360 - angle;
		return angle;
	}
}
