import { spawn } from "./utils.js"
import { Vector2 as Vector } from "./Vector2.js"

function make_cumsum(arr) {
	for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
	return arr;
}

function normalize_cumsum(arr) {
	for (let i = 0; i < arr.length; i++) arr[i] /= arr[arr.length - 1];
	return arr;
}

function weightened_random(dst, arr) {
	let result = Math.random();
	let arr_copy = arr.slice();
	arr_copy.sort(() => Math.random() - 0.5);
	let weights = [];
	for (let item of arr_copy) weights.push(item["weight"](dst));
	weights = normalize_cumsum(make_cumsum(weights));
	
	for (let i = 0; i < weights.length; i++) {
		if (weights[i] > result) { return arr_copy[i] };
	}
}

function log(b, x) { return Math.log2(x) / Math.log2(b) }

function random_range(from, to) { return Math.random() * (to - from) + from }

const obstacles = [
	{
		"weight": (dst) => {return Math.log2(dst) * 100 + 4e3},
		"spacing": 1,
		"objects": [
			{
				"type": "obstacle_Spikes",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 200},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.5, dst) * 100 + 3.5e3},
		"spacing": 2,
		"objects": [
			{
				"type": "obstacle_Spikes2",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 200},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.25, dst) * 100 + 2.3e3},
		"spacing": 3,
		"objects": [
			{
				"type": "obstacle_Spikes3",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 200},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.125, dst) * 100},
		"spacing": 4,
		"objects": [
			{
				"type": "obstacle_Spikes4",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 200},
				angle: () => {return 0}
			}
		]
	},
]

const bonuses = [
	{
		"weight": (dst) => {return Math.log2(dst) * 100 + 4e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.5, dst) * 100 + 3.5e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(-.5, 0) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(0, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.25, dst) * 100 + 2.3e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(-.5, -.166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(-.166, .166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Coin",
				"x": (mesh_wd) => {return random_range(.166, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return Math.log2(dst) * 100 + 4e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.5, dst) * 100 + 3.5e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(-.5, 0) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(0, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.25, dst) * 100 + 2.3e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(-.5, -.166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(-.166, .166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Nitro",
				"x": (mesh_wd) => {return random_range(.166, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return Math.log2(dst) * 100 + 4e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(-.5, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.5, dst) * 100 + 3.5e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(-.5, 0) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(0, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	},
	{
		"weight": (dst) => {return log(1.25, dst) * 100 + 2.3e3},
		"spacing": 0,
		"objects": [
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(-.5, -.166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(-.166, .166) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			},
			{
				"type": "bonus_Rocket",
				"x": (mesh_wd) => {return random_range(.166, .5) * (mesh_wd - 20)},
				"y": () => {return random_range(-.5, .5) * 300},
				angle: () => {return 0}
			}
		]
	}
]

const empty = {
	"objects": []
}

export function spawn_generated(runtime, arr, curve, mesh_wd) {
	if (arr.length != 10) throw Error("Should be 10 segments on a curve");
	for (let i = 0; i < arr.length; i++) {
		let base_point = i * .1 + .05;
		let base_dst = curve.getDistanceOfPoint(base_point);
		let item = arr[i]["objects"];
		for (let elem of item) {
			let type_data = elem["type"].split("_");
			let y_shift = elem["y"]();
			let x_shift = elem["x"](mesh_wd);
			let d = curve.getPointDistance(base_dst + y_shift);
			let point = curve.getPointOffset(d, x_shift);
			let obj = spawn(runtime.objects[type_data[0]], "Level", point, false);
			obj.setAnimation(type_data[1]);
			let angle = -curve.getTangent(d).angleSigned(new Vector(1, 0)) + elem["angle"]() + 90;
			console.log("Angle:", angle);
			obj.angleDegrees = angle;
		}
	}
}

export function generate_road(dst, leftover_spacing) {
	if (leftover_spacing === undefined) leftover_spacing = 0;
	let result = [];
	for (let i = 0; i < 10; i++) {
		const roll = Math.random();
		if (leftover_spacing > 0) {
			if (roll < .5) {
				result.push(weightened_random(dst, bonuses));
			} else result.push(empty);
			leftover_spacing -= 1;
		} else {
			if (roll < .166) {
				result.push(empty);
			} else if (roll > .833) {
				result.push(weightened_random(dst, bonuses));
			} else {
				let item = weightened_random(dst, obstacles);
				result.push(item);
				leftover_spacing = item["spacing"];
			}
		}
	}
	return {"data": result, "spacing": leftover_spacing};
}