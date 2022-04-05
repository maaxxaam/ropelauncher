//////////////////////////////////////////////////////
///
/// Javascript port of my Actionscript Vector2 library
/// class for generic 2d vector operations and more
/// Dogan CORUH
/// 11.01.2013
/// 
//////////////////////////////////////////////////////

function MathHelper() {

}

/**
 * Converts radian to degree
 */
MathHelper.toDegree = function (angle) {
    return angle * 180 / Math.PI;
}

/**
 * Converts degree to radian
 */
MathHelper.toRadian = function (angle) {
    return angle * Math.PI / 180;
}

MathHelper.degAcos = function(dot) {
	return MathHelper.toDegree(Math.acos(dot));
}

/**
 * Vector2 class for instances
 */
export function Vector2(x, y) {
	if (Number.isNaN(x)) x = 0;
	if (Number.isNaN(y)) y = 0;
	
	return {x: x, y: y, clone: function () {
        return new Vector2(this.x, this.y);
    }}
}

/**
* Adds two vectors with each other
*/
Vector2.add = function(v1, v2) {
	return Vector2(v1.x + v2.x, v1.y + v2.y);
}
/**
* Subtracts second vector from first vector
* @summary Subtracts second vector from first vector
*/
Vector2.subtract = function(v1, v2) {
	return Vector2(v1.x - v2.x, v1.y - v2.y);
}
/**
* Multiplies vector x,y,z components with a scaler value
* @summary Multiplies vector x,y,z components with a scaler value
*/
Vector2.multiply = function(v, scaler) {
	return Vector2(v.x * scaler, v.y * scaler);
}
/**
* Divides vector x,y,z components with a divider value
* @summary Divides vector x,y,z components with a divider value
*/
Vector2.divide = function(v, divider) {
	return Vector2(v.x / divider, v.y / divider);
}
/**
* Inverses vector
* @summary Inverses vector
*/
Vector2.inverse = function(v) {
	return Vector2(-v.x, -v.y);
}
/**
* returns dot product of two given vectors
* @summary returns dot product of two given vectors
*/
Vector2.dot = function(v1, v2, debug) {
	if (debug) console.log(v1, v2);
	return (v1.x * v2.x) + (v1.y * v2.y);
}
/**
* returns the length of vector
* @summary returns the length of vector
*/
Vector2.magnitude = function(v) {
	return Math.sqrt(Vector2.dot(v, v));
}
/**
* sets length of given vector and return it
* @summary sets length of given vector and return it
*/
Vector2.setLength = function(v, length) {
	var len_factor = length / Vector2.magnitude(v);
	return Vector2.multiply(v, len_factor);
}
/**
* returns true if the vector is zero vector
* @summary returns true if the vector is zero vector
*/
Vector2.isZeroVector = function(v) {
	return ((v.x == 0) && (v.y == 0));
}
/**
* returns unit vector from given vector
* @summary returns unit vector from given vector
*/
Vector2.normalize = function(v) {
	var mag = Vector2.magnitude(v);
	if (mag == 0) return Vector2(0, 0);
	else return Vector2.divide(v, mag);
}
/**
* returns cross product of two given vectors
* @summary returns cross product of two given vectors
*/
Vector2.cross = function(v1, v2) {
	return (v1.x * v2.y) - (v2.x * v1.y);
}
/**
* returns the distance from one vector to another
* @summary returns the distance from one vector to another
*/
Vector2.distance = function(v1, v2) {
	return Vector2.magnitude(Vector2.subtract(v1, v2));
}
/**
* rotates a vector with given radian angle
* @summary rotates a vector with given radian angle
* @explicit thanks to Sinan
*/
Vector2.rotateRadian = function(v, radian) {
	var vr = Vector2(0, 0);

	vr.x = v.x * Math.cos(radian) - v.y * Math.sin(radian);
	vr.y = v.y * Math.cos(radian) + v.x * Math.sin(radian);

	return vr;
}
/**
* rotates a vector with given degree angle
* @summary rotates a vector with given degree angle
* @explicit thanks to Sinan
*/
Vector2.rotateDegree = function(v, degree) {
	return Vector2.rotateRadian(v, MathHelper.toRadian(degree));
}


/**
* returns unsigned degree angle between 0 and +180 by given two vectors
* @summary returns unsigned degree angle between 0 and +180 by given two vectors
*/
Vector2.angleUnsigned = function(v1, v2) {
	var va = Vector2.normalize(v1);
	var vb = Vector2.normalize(v2);

	return MathHelper.degAcos(Vector2.dot(va, vb));
}
/**
* returns signed degree angle between -180 and +180 by given two vectors
* @summary returns signed degree angle between -180 and +180 by given two vectors
*/
Vector2.angleSigned = function(v1, v2) {
	var va = Vector2.normalize(v1);
	var vb = Vector2.normalize(v2);
	var deg = MathHelper.degAcos(Vector2.dot(va, vb));
	
	return deg * Math.sign(Vector2.cross(vb, va));
}
/**
* returns degree angle between 0 and 360 by given two vectors
* @summary returns degree angle between 0 and 360 by given two vectors
*/
Vector2.angle360 = function(v1, v2) {
	var va = Vector2.normalize(v1);
	var vb = Vector2.normalize(v2);
	var deg = MathHelper.degAcos(Vector2.dot(va, vb));
	
	return Vector2.cross(vb, va) > 0 ? deg : 360 - deg;
}

/**
	* Compares two vectors for their equality?
	* @summary Compares two vectors for their equality?
	* @param	v1 "First vector to compare."
	* @param	v2 "Second vector to compare."
	* @return "True of false by comparison."
	*/
Vector2.isEqual = function isEqual(v1, v2)
{
	return (v1.x == v2.x) && (v1.y == v2.y);
}
