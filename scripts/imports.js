import { Vector2 } from './Vector2.js'
import { generate_road, spawn_generated } from './endless.js'
import * as Editor from './bezier.js'

export var RoadEditor = new Editor.CurveEditor();
export var Vector = Vector2;

function lerp(a,b,f) { return (b-a)*f+a; };

export function clamp(low, a, high) { return a < low ? low : (a > high ? high : a); };

export function tile_degrees(integer) {
	let horizontal = -((integer & ITilemapInstance.TILE_FLIPPED_HORIZONTAL) >> 31);
	let vertical = (integer & ITilemapInstance.TILE_FLIPPED_VERTICAL) >> 30;
	let diagonal = (integer & ITilemapInstance.TILE_FLIPPED_DIAGONAL) >> 29;
	if (horizontal & diagonal) return 90;
	else if (horizontal & vertical) return 180;
	else if (vertical & diagonal) return 270;
	else return 0;
};

function Point(x, y) {
	return new Vector(x, y);
}

export function layer_to_layer_px(x, y, layer_from, layer_to) { // assuming both point are visible, i guess
let [cssx, cssy] = layer_from.layerToCssPx(x, y);
let [fx, fy] = layer_to.cssPxToLayer(cssx, cssy);
return [fx, fy];
}

function project_point_onto_vector(vector, point) {
	const dot_over_len2 = vector.dot(point) / vector.dot(vector);
	let res_point = vector.multiply(dot_over_len2);
	res_point.pre_dot = vector.dot(point);
	res_point.len_sqr = Math.abs(res_point.pre_dot);
	return res_point;
}

function project_line_onto_vector(vector, point1, point2) {
	return [project_point_onto_vector(vector, point1), project_point_onto_vector(vector, point2)];
}

export function distance_line_point(edge1, edge2, point){
	const edge_vector = edge2.subtract(edge1);
	const other_vector = point.subtract(edge1);
	return edge_vector.cross(other_vector) / edge2.distance(edge1);
}

function line_intersection_point(edge1, edge2) {
	let edge1vec = edge1[0].subtract(edge1[1]);
	let edge2vec = edge2[0].subtract(edge2[1]);
	let edgeCross = edge1vec.cross(edge2vec);
	let edge1cross = edge1[0].cross(edge1[1]);
	let edge2cross = edge2[0].cross(edge2[1]);
	let result = edge2vec.multiply(edge1cross).subtract(edge1vec.multiply(edge2cross));
	return result.divide(edgeCross);
}

function vertices_clockwise_sort(vertices) {
	// calc centroid
	let centroid = Point(0, 0);
	for (let point of vertices) centroid.add(point);
	centroid = centroid.divide(vertices.length);
	
	return vertices.sort((a, b) => {
    	return Math.atan2(a.y - centroid.y, a.x - centroid.x)
        	 - Math.atan2(b.y - centroid.y, b.x - centroid.x);
	});
}

function point_right_side(edge, point) {
	let edgeVec = edge[1].subtract(edge[0]);
	let edgeRNormal = new Vector(edgeVec.y, -edgeVec.x);
	let pointVec = point.subtract(edge[0]);
	return Math.sign(edgeVec.cross(pointVec)) == Math.sign(edgeVec.cross(edgeRNormal));
}

function simple_sutherland_hodgman_clipping(edgeInc, edgeClip, del) {
	let res = [];
	if (point_right_side(edgeClip, edgeInc[1])) {
		if (!point_right_side(edgeClip, edgeInc[0])) {
			if (!del) res.push(line_intersection_point(edgeInc, edgeClip));
		} else {
			if (!del) res.push(edgeInc[0])
		}
		res.push(edgeInc[1]);
	} else if (point_right_side(edgeClip, edgeInc[0])) {
		res.push(edgeInc[0]);
		if (!del) res.push(line_intersection_point(edgeInc, edgeClip));
	} else {
		return simple_sutherland_hodgman_clipping(edgeInc, edgeClip.reverse(), del);
	}
	
	return res;
}

function cannot_get_poly(sprite) {
	return (typeof(sprite.getPolyPoint) == "undefined" || typeof(sprite.getPolyPointCount) == "undefined")
}

function get_polygon_normals(sprite) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite)) throw "Not a Sprite: cannot access collision polygon";
	var normals = [];
	
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let [edge1, edge2] = [Point(0, 0), Point(0,0)];
		[edge1.x, edge1.y] = sprite.getPolyPoint(i);
		[edge2.x, edge2.y] = sprite.getPolyPoint(i + 1);
		let normal = new Vector(edge2.y - edge1.y, edge1.x - edge2.x).normalize();
		normals.push(normal);
	}
	
	return normals;
}

function project_collision_onto_vector(sprite, vector) {
	let point = Point(sprite.getPolyPointX(0), sprite.getPolyPointY(0));
	
	let proj = [new Point(Infinity, Infinity), new Point(-Infinity, -Infinity)];
	proj[0] = project_point_onto_vector(vector, point);
	proj[1] = project_point_onto_vector(vector, point);
	for (let i = 1; i < sprite.getPolyPointCount(); i++) {
		[point.x, point.y] = sprite.getPolyPoint(i);
		const projected = project_point_onto_vector(vector, point);
		if (proj[0].pre_dot > projected.pre_dot) proj[0] = projected;
		if (proj[1].pre_dot < projected.pre_dot) proj[1] = projected;
	}
	return proj;
}

function brings_closer(sprite1, sprite2, normal, from_1) {
	let s1 = new Vector(sprite1.x, sprite1.y);
	let s2 = new Vector(sprite2.x, sprite2.y);
	var between = s1.subtract(s2);
	if (from_1) between = between.inverse();
	return between.angleUnsigned(normal) < 90;
}

export function close_projection_points(sprite1, sprite2, normal) {
	let proj1 = project_collision_onto_vector(sprite1, normal);
	// find projection of sprite2 onto normal
	let proj2 = project_collision_onto_vector(sprite2, normal);
	// see if they overlap
	// !IMPORTANT! The following math works assuming all coordinates have the same sign
	let over1 = proj1[0].pre_dot > proj2[0].pre_dot ? proj1[0] : proj2[0];
	let over2 = proj1[1].pre_dot < proj2[1].pre_dot ? proj1[1] : proj2[1];
	return [over1, over2];
}

export function SAT_collision(sprite1, sprite2) {
	let col_normal = new Vector(0, 0);
	let overlap = new Vector(Infinity, Infinity);
	overlap.len_sqr = Infinity;
	
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	
	var normals = get_polygon_normals(sprite1).concat(get_polygon_normals(sprite2));
	const half = sprite1.getPolyPointCount() - 1; //normal amount = edges = points - 1
	let obj = sprite1;
	
	for (let i = 0; i < normals.length; i++) {
		const normal = normals[i];
		// see if they overlap
		// !IMPORTANT! The following math works assuming all coordinates have the same sign
		let [over1, over2] = close_projection_points(sprite1, sprite2, normal);
		if (over1.pre_dot > over2.pre_dot) { // no overlap
			return {collided: false};
		} else {
			let overVec = over2.subtract(over1);
			overVec.len_sqr = overVec.dot(overVec);
			if ((overVec.len_sqr < overlap.len_sqr) || (overVec.len_sqr == overlap.len_sqr && (brings_closer(sprite1, sprite2, normal, i < half)))) {
				overlap = overVec;
				col_normal = normal;
				obj = i < half ? sprite1 : sprite2;
			}
		}
	}
	return {collided: true, normal: col_normal, overlap: overlap, obj: obj};
}

export function furthest_point_from_vector(sprite, vector) {
	let farthest = new Point(-Infinity, -Infinity);
	farthest.pre_dot = -Infinity;
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let point = new Point(0, 0);
		[point.x, point.y] = sprite.getPolyPoint(i);
		
		let dot = point.dot(vector);
		if (dot > farthest.pre_dot) { 
			farthest = point;
			farthest.pre_dot = dot;
			farthest.index = i;
		}
	}
	return farthest;
}

function orthogonal_neighbour_edge(sprite, point, index, normal) {
	let res = new Point(0, 0);
	let edge1 = new Point(0, 0);
	let edge2 = new Point(0, 0);
	edge1.index = index - 1;
	if (index == 0) edge1.index += sprite.getPolyPointCount();
	[edge1.x, edge1.y] = sprite.getPolyPoint(edge1.index);
	[edge2.x, edge2.y] = sprite.getPolyPoint(index + 1);
	edge2.index = index + 1;
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	const n1 = point.subtract(edge1).normalize();
	const n2 = edge2.subtract(point).normalize();
	edge1.pre_dot = n1.dot(normal);
	edge2.pre_dot = n2.dot(normal);
	if (Math.abs(edge1.pre_dot) < Math.abs(edge2.pre_dot)) {
		point.pre_dot = edge1.pre_dot;
		return [edge1, point];
	} else {
		point.pre_dot = edge2.pre_dot;
		return [point, edge2];
	}
}

export function get_collision_point(sprite1, sprite2, collision_data) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	// get colliding edges
	
	if (collision_data.obj === sprite1) {
		var point10 = furthest_point_from_vector(sprite1, collision_data.normal);
		var point20 = furthest_point_from_vector(sprite2, collision_data.normal.inverse());
	} else {
		var point10 = furthest_point_from_vector(sprite1, collision_data.normal.inverse());
		var point20 = furthest_point_from_vector(sprite2, collision_data.normal);
	}
	
	let point11 = Point(0, 0);
	[point10, point11] = orthogonal_neighbour_edge(sprite1, point10, point10.index, collision_data.normal);
	let point21 = Point(0, 0);
	[point20, point21] = orthogonal_neighbour_edge(sprite2, point20, point20.index, collision_data.normal);
	
	// choose reference and incident faces
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	if (Math.abs(point11.pre_dot) < Math.abs(point21.pre_dot)) {
		var ref_sprite = sprite1;
		var inc_sprite = sprite2;
		var ref = [point10, point11];
		var inc = [point20, point21];
	} else {
		var inc_sprite = sprite1;
		var ref_sprite = sprite2;
		var inc = [point10, point11];
		var ref = [point20, point21];
	}
	// adjacent face clipping
	
	let point00 = new Vector(0, 0);
	let point30 = new Vector(0, 0);
	[point30.x, point30.y] =  ref_sprite.getPolyPoint((ref[0].index + 2) % ref_sprite.getPolyPointCount());
	[point00.x, point00.y] =  ref_sprite.getPolyPoint(ref[0].index == 0 ? ref_sprite.getPolyPointCount() - 1 : ref[0].index - 1);
	let inter = simple_sutherland_hodgman_clipping(inc, [point00, ref[0]]);
	inter = simple_sutherland_hodgman_clipping(inter, [point30, ref[1]]);
	let result = simple_sutherland_hodgman_clipping(inter, [ref[0], ref[1]], true)[0];
	result.ref = ref;
	result.inc = inc;
	result.p0 = point00;
	result.p3 = point30;
	result.cut = inter;
	// try simple intersection instead
	//let result = line_intersection_point(inc, ref);
	
	return result;
}

function point_between_points(x1, y1, x2, y2, x3, y3) {
	// this function is sponsored by StackOverflow
	// https://stackoverflow.com/questions/11907947/how-to-check-if-a-point-lies-on-a-line-between-2-other-points
	let currPoint = new Point(x2, y2);
	let point1 = new Point(x1, y1);
	let point2 = new Point(x3, y3);
	
	let dc = currPoint.subtract(point1);
	let dl = point2.subtract(point1);
	
	// Check if point lies on a line
	let cross = dc.cross(dl);
	if (cross >= 1e-10 && cross <= -1e-10) return false; // allow floating-point errors
	
	// Check if point lies between two points
	if (Math.abs(dl.x) >= Math.abs(dl.y))
		return dl.x > 0 ? 
			point1.x <= currPoint.x && currPoint.x <= point2.x :
			point2.x <= currPoint.x && currPoint.x <= point1.x;
	else
		return dl.y > 0 ? 
			point1.y <= currPoint.y && currPoint.y <= point2.y :
			point2.y <= currPoint.y && currPoint.y <= point1.y;
}

export function car_collision_resolution(car1, car2, collision_data, collision_point) {
	let cars = [car1, car2];
	let [vels, avs, invmasses, astarts, avecs] = [[], [], [], [], []];
	
	for (let car of cars) { 
		vels.push(new Vector(car.behaviors.Car.vectorX, car.behaviors.Car.vectorY));
		avecs.push(collision_point.subtract(new Vector(car.x, car.y)));
		invmasses.push(1 / car.instVars.Mass);
		astarts.push(car.behaviors.Car.steering ? car.behaviors.Car.steerSpeed : 0)
	}
	
	const normal = collision_data.normal;
	const rel_vel = vels[0].subtract(vels[1]);
	const I = 1000000;
	const eps = 1.1; // > 1 - more energy, < 1 - less energy 
	
	let up = rel_vel.multiply(-(1 + eps)).dot(normal);
	let down = normal.dot(normal.multiply(invmasses[0] + invmasses[1]));
	for (let avec of avecs) down += Math.pow(avec.dot(normal), 2) / I;
	let j = up / down;
	
	let fin_vel1 = vels[0].add(normal.multiply(j * invmasses[0]));
	let fin_vel2 = vels[1].subtract(normal.multiply(j * invmasses[1]));
	
	for (let i = 0; i < 2; i++) avs.push(astarts[i] + avecs[i].dot(normal.multiply(j)) / I);

	return [fin_vel1.x, fin_vel1.y, avs[0], fin_vel2.x, fin_vel2.y, avs[1]];
}