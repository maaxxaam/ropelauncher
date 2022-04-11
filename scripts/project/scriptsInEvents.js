import { Vector2 } from './Vector2.js'

function lerp(a,b,f) { return (b-a)*f+a; };

function Point(x, y) {
	return {x:x, y:y}
}

function test_tile_for_corner(tile) {
	var no_extra_bits = (tile & ~151) == 0;
	var has_148 = (tile & 148) == 148;
	var has_130 = (tile & 130) == 130;
	return no_extra_bits && (has_130 || has_148);
}

function map_corners_to_pos(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = tile & 1;
	} else {
		res = (tile & 1) | 2;
	}
	return res;
}

function map_corners_to_clock(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = tile & 1;
	} else {
		res = ((tile & 1) ^ 1) | 2;
	}
	return res;
}

function map_corners_to_circle(tile) {
	var res = 0;
	if ((tile & 130) == 130) {
		res = ((tile & 1) ^ 1) + 1;
	} else {
		res = (5 - (tile & 7)) * 3;
	}
	return res;
}

function project_point_onto_vector(vector, point) {
	const dot_over_len2 = Vector2.dot(vector, point) / (vector.x * vector.x + vector.y * vector.y);
	let res_point = new Point(vector.x * dot_over_len2, vector.y * dot_over_len2);
	res_point.len_sqr = Math.abs(Vector2.dot(vector, point));
	return res_point;
}

function project_line_onto_vector(vector, point1, point2) {
	return [project_point_onto_vector(vector, point1), project_point_onto_vector(vector, point2)];
}

function line_intersection_point(edge1, edge2) {
	let edge1vec = Vector2.subtract(edge1[0], edge1[1]);
	let edge2vec = Vector2.subtract(edge2[0], edge2[1]);
	let edgeCross = Vector2.cross(edge1vec, edge2vec);
	let edge1cross = Vector2.cross(edge1[0], edge1[1]);
	let edge2cross = Vector2.cross(edge2[0], edge2[1]);
	let fin = Vector2.subtract(Vector2.multiply(edge2vec, edge1cross), Vector2.multiply(edge1vec, edge2cross));
	return Vector2.divide(fin, edgeCross);
}

function vertices_clockwise_sort(vertices) {
	// calc centroid
	let centroid = Point(0, 0);
	for (let point of vertices) Vector2.add(centroid, point);
	centroid = Vector2.divide(centroid, vertices.length);
	
	return vertices.sort(function(a, b) {
    	return Math.atan2(a.y - centroid.y, a.x - centroid.x)
        	 - Math.atan2(b.y - centroid.y, b.x - centroid.x);
	});
}

function edge_right_side(edge, point) {
	let edgeVec = Vector2.subtract(edge[1], edge[0]);
	let pointVec = Vector2.subtract(point, edge[0]);
	return Vector2.cross(edgeVec, pointVec) > 0
}

function simple_sutherland_hodgman_clipping(edgeInc, edgeClip, del) {
	let res = [];
	if (edge_right_side(edgeClip, edgeInc[1])) {
		if (!del) {
			res.push(line_intersection_point(edgeInc, edgeClip));
		}
		res.push(edgeInc[1]);
	} else if (edge_right_side(edgeClip, edgeInc[0])) {
		if (!del) res.push(edgeInc[1]);
		res.push(line_intersection_point(edgeInc, edgeClip));
	} else {
		res = edgeInc;
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
		let perpendicular = Vector2.normalize(new Vector2(edge1.y - edge2.y, edge2.x - edge1.x));
		normals.push(perpendicular);
	}
	
	return normals;
}

function project_collision_onto_vector(sprite, vector) {
	let [edge1, edge2] = [Point(0, 0), Point(0,0)];
	
	let proj = [new Point(Infinity, Infinity), new Point(-Infinity, -Infinity)];
	proj[0].len_sqr = Infinity;
	proj[1].len_sqr = 0;
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		[edge1.x, edge1.y] = sprite.getPolyPoint(i);
		[edge2.x, edge2.y] = sprite.getPolyPoint(i + 1);
		if (edge2.x < edge1.x || (edge1.x == edge2.x && edge2.y < edge1.y)) { // swap edges
			let [temp1, temp2] = [edge1.x, edge1.y];
			[edge1.x, edge1.y] = [edge2.x, edge2.y];
			[edge2.x, edge2.y] = [temp1, temp2];
		}
		const [point1, point2] = project_line_onto_vector(vector, edge1, edge2);
		if (proj[0].len_sqr > point1.len_sqr) proj[0] = point1;
		if (proj[1].len_sqr < point2.len_sqr) proj[1] = point2;
	}
	return proj;
}

export function SAT_collision(sprite1, sprite2) {	
	let col_normal = Vector2(0, 0);
	let overlap = Vector2(Infinity, Infinity);
	overlap.len_sqr = Infinity;
	
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	
	var normals = get_polygon_normals(sprite1).concat(get_polygon_normals(sprite2));
	let half = sprite1.getPolyPointCount();
	let obj = sprite1;
	
	for (let normal of normals) {
		let [edge1, edge2] = [Point(0, 0), Point(0,0)];
		// find projection of sprite1 onto normal
		let proj1 = project_collision_onto_vector(sprite1, normal);
		// find projection of sprite2 onto normal
		let proj2 = project_collision_onto_vector(sprite2, normal);
		// see if they overlap
		// !IMPORTANT! The following math works assuming all coordinates have the same sign
		let over1 = proj1[0].len_sqr > proj2[0].len_sqr ? proj1[0] : proj2[0];
		let over2 = proj1[1].len_sqr < proj2[1].len_sqr ? proj1[1] : proj2[1];
		if (over1.len_sqr > over2.len_sqr) { // no overlap
			return {collided: false};
		} else {
			let overVec = Vector2.subtract(over2, over1);
			overVec.len_sqr = Vector2.dot(overVec, overVec);
			if (overVec.len_sqr < overlap.len_sqr) {
				overlap = overVec;
				col_normal = normal;
				obj = normals.indexOf(normal) < half ? sprite1 : sprite2;
			}
		}
	}
	return {collided: true, normal: col_normal, overlap: overlap, obj: obj};
}

function furthest_point_from_vector(sprite, vector) {
	let farthest = new Point(0, 0);
	farthest.len_sqr = 0;
	
	for (let i = 0; i < sprite.getPolyPointCount(); i++) {
		let point = new Point(0, 0);
		[point.x, point.y] = sprite.getPolyPoint(i);
		
		let projected = project_point_onto_vector(point, vector);
		//debugger;
		
		if (projected.len_sqr > farthest.len_sqr) { 
			farthest = point;
			farthest.len_sqr = projected.len_sqr;
			farthest.index = i;
		}
	}
	return farthest;
}

function orthogonal_neighbour_edge(sprite, point, index, normal) {
	let res = new Point(0, 0);
	let edge1 = new Point(0, 0);
	let edge2 = new Point(0, 0);
	edge1.index = index == 0 ? sprite.getPolyPointCount() : index - 1;
	[edge1.x, edge1.y] = sprite.getPolyPoint(edge1.index);
	[edge2.x, edge2.y] = sprite.getPolyPoint(index + 1);
	edge2.index = index + 1;
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	edge1.dot = Vector2.dot(Vector2.subtract(point, edge1), normal);
	edge2.dot = Vector2.dot(Vector2.subtract(edge2, point), normal);
	return Math.abs(edge1.dot) < Math.abs(edge2.dot) ? [edge1, point] : [point, edge2];
}

export function get_collision_point(sprite1, sprite2, collision_data) {
	// Check if we can access needed Sprite functions
	if (cannot_get_poly(sprite1) || cannot_get_poly(sprite2)) throw "Not a Sprite: cannot access collision polygon";
	
	// get colliding edges (sort of)
	let point10 = furthest_point_from_vector(sprite1, collision_data.normal);
	let point20 = furthest_point_from_vector(sprite2, Vector2.inverse(collision_data.normal));
	let point11 = Point(0, 0);
	[point10, point11] = orthogonal_neighbour_edge(sprite1, point10, point10.index, collision_data.normal);
	let point21 = Point(0, 0);
	[point20, point21] = orthogonal_neighbour_edge(sprite2, point20, point20.index, collision_data.normal);
	
	// choose reference and incident faces
	// choose the one most orthogonal based on dot product (maybe incorrect but works fine)
	if (Math.abs(point11.dot) < Math.abs(point21.dot)) {
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
	let point00 = Vector2(0, 0);
	let point30 = Vector2(0, 0);
	[point30.x, point30.y] =  ref_sprite.getPolyPoint((ref[0].index + 2) % ref_sprite.getPolyPointCount());
	[point00.x, point00.y] =  ref_sprite.getPolyPoint(ref[0].index == 0 ? ref_sprite.getPolyPointCount() - 1 : ref[0].index - 1);
	inc = simple_sutherland_hodgman_clipping(inc, [point00, ref[0]]);
	inc = simple_sutherland_hodgman_clipping(inc, [ref[1], point30]);
	let [result] = simple_sutherland_hodgman_clipping(inc, [ref[0], ref[1]], true);
	
	return result;
}

function point_between_points(x1, y1, x2, y2, x3, y3) {
	// this function is sponsored by StackOverflow
	// https://stackoverflow.com/questions/11907947/how-to-check-if-a-point-lies-on-a-line-between-2-other-points
	let currPoint = new Vector2(x2, y2);
	let point1 = new Vector2(x1, y1);
	let point2 = new Vector2(x3, y3);
	
	let dc = Vector2.subtract(currPoint, point1);
	let dl = Vector2.subtract(point2, point1);
	
	// Check if point lies on a line
	let cross = Vector2.cross(dc, dl);
	if (cross >= 1e-10 && cross <= -1e-10) return false;
	
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
		vels.push(Vector2(car.behaviors.Car.vectorX, car.behaviors.Car.vectorY));
		avecs.push(Vector2.subtract(collision_point, Vector2(car.x, car.y)));
		invmasses.push(1 / car.instVars.Mass);
		astarts.push(car.behaviors.Car.steering ? car.behaviors.Car.steerSpeed : 0)
	}
	
	const normal = collision_data.normal;
	const rel_vel = Vector2.subtract(vels[0], vels[1]);
	const I = 1000000;
	const eps = 1.1; // > 1 - more energy, < 1 - less energy 
	
	let up = Vector2.dot(Vector2.multiply(rel_vel, -(1 + eps)), normal);
	let down = Vector2.dot(normal, Vector2.multiply(normal, (invmasses[0] + invmasses[1])));
	for (let avec of avecs) down += Math.pow(Vector2.dot(avec, normal), 2)/I;
	let j = up / down;
	
	let fin_vel1 = Vector2.add(vels[0], Vector2.multiply(normal, j*invmasses[0]));
	let fin_vel2 = Vector2.subtract(vels[1], Vector2.multiply(normal, j*invmasses[1]));
	
	for (let i = 0; i < 2; i++) avs.push(astarts[i] + Vector2.dot(avecs[i], Vector2.multiply(normal, j)) / I);

	return [fin_vel1.x, fin_vel1.y, avs[0], fin_vel2.x, fin_vel2.y, avs[1]];
}


const scriptsInEvents = {

		async Gamesheet_Event60_Act1(runtime, localVars)
		{
			let obs = runtime.objects.Obstacle.getFirstPickedInstance();
			let car = runtime.objects.car_edge_collision.getFirstPickedInstance();
			let collision = SAT_collision(car, obs);
			let point = get_collision_point(car, obs, collision);
			let new_spark = runtime.objects.EdgeSparks.createInstance("Level", point.x, point.y, false);
			new_spark.angleDegrees = car.angleDegrees - 180;
		},

		async Gamesheet_Event79(runtime, localVars)
		{
			// let's perform collision checks for cars! yay!
			const dt = runtime.dt;
			const all_cars = runtime.objects.Car.getAllInstances();
			for (let index1 = 0; index1 < all_cars.length; index1++) {
				for (let index2 = 0; index2 < all_cars.length; index2++) {
					if (index1 == index2) continue;
					
					let cars = [all_cars[index1], all_cars[index2]];
					let [cols, vecs, angdiffs] = [[], [], []];
					for (let car of cars) {
						cols.push(car.getChildAt(0));
						vecs.push([car.behaviors.Car.vectorX, car.behaviors.Car.vectorY]);
						angdiffs.push(car.behaviors.Car.facingAngle - car.angle);
						car.x += car.behaviors.Car.vectorX * dt;
						car.y += car.behaviors.Car.vectorY * dt;
						car.angle = car.behaviors.Car.facingAngle;
					}
					const col_data = SAT_collision(cols[0], cols[1]);
					if (col_data.collided) {
						const point = get_collision_point(cols[0], cols[1], col_data);
						let new_v = [[0, 0], [0, 0]];
						let new_av = [0, 0];
						[new_v[0][0], new_v[0][1], new_av[0], new_v[1][0], new_v[1][1], new_av[1]] = car_collision_resolution(cars[0], cars[1], col_data, point, runtime);
						for (let i = 0; i < 2; i++) {
							cars[i].x -= col_data.overlap.x / 2 * (-i * 2 + 1) * ((col_data.obj === cars[0]) * 2 - 1);
							cars[i].y -= col_data.overlap.y / 2 * (-i * 2 + 1) * ((col_data.obj === cars[0]) * 2 - 1);
							cars[i].behaviors.Car.setImpulse(new_v[i][0], new_v[i][1]);
							cars[i].behaviors.Car.setVector(new_v[i][0], new_v[i][1]);
							cars[i].behaviors.Car.spin = new_av[i] * (-i * 2 + 1);
						}
					}
					
					for (let i = 0; i < 2; i++) {
						cars[i].x -= vecs[i][0] * dt;
						cars[i].y -= vecs[i][1] * dt;
						cars[i].angle -= angdiffs[i];
					}
				}
			}
		},

		async Gamesheet_Event96_Act2(runtime, localVars)
		{
			const tile = localVars.tile;
			console.log(tile);
			localVars.is_start = ((tile == 1) || (tile == 19) || (tile == 37) || (tile == 55));
		},

		async Gamesheet_Event104_Act2(runtime, localVars)
		{
			localVars.is_corner = test_tile_for_corner(localVars.tile);
		},

		async Gamesheet_Event105_Act3(runtime, localVars)
		{
			localVars.clock_id = map_corners_to_clock(localVars.tile);
			localVars.pos_id = map_corners_to_pos(localVars.tile);
			localVars.circle_id = map_corners_to_circle(localVars.tile);
			//alert(localVars.tile + " " + localVars.clock_id + " " + localVars.pos_id);
		},

		async Devtodev_Event2(runtime, localVars)
		{
			runtime.setReturnValue(initDevtodev(localVars.platformType, localVars.playerID))
		},

		async Devtodev_Event4(runtime, localVars)
		{
			runtime.setReturnValue(d2d_setLevel(localVars.Level))
		},

		async Devtodev_Event6(runtime, localVars)
		{
			runtime.setReturnValue(d2d_lvlUp(localVars.Level))
		},

		async Devtodev_Event8(runtime, localVars)
		{
			runtime.setReturnValue(d2d_onPayment(localVars.id, localVars.name, localVars.price, localVars.type, localVars.amount, localVars.currency, localVars.cur_amount))
		},

		async Devtodev_Event10(runtime, localVars)
		{
			runtime.setReturnValue(d2d_startProgressionEvent(localVars.name))
		},

		async Devtodev_Event12(runtime, localVars)
		{
			var succ = false;
			if (localVars.success > 0) succ = true;
			console.log("Succ is " + succ);
			runtime.setReturnValue(d2d_quickEndProgressionEvent(localVars.name, succ));
		},

		async Devtodev_Event14(runtime, localVars)
		{
			runtime.setReturnValue(d2d_tutorialStep(localVars.step))
		}

};

self.C3.ScriptsInEvents = scriptsInEvents;

