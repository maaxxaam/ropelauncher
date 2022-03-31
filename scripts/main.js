import { car_collision_resolution } from "./imports.js"
// Import any other script files here, e.g.:
// import * as myModule from "./mymodule.js";

runOnStartup(async runtime =>
{
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	
	runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
});

async function OnBeforeProjectStart(runtime)
{
	// Code to run just before 'On start of layout' on
	// the first layout. Loading has finished and initial
	// instances are created and available to use here.
	//devtodev.setDebugLog(true);
	
	runtime.addEventListener("tick", () => Tick(runtime));
}

function Tick(runtime)
{
	let dt = runtime.dt;
	let layout = runtime.layout.name;
	if (layout != "Menu") { // on a game level
		// let's perform collision checks for cars! yay!
		let cars = runtime.objects.Car.getAllInstances();
		for (let index1 = 0; index1 < cars.length - 1; index1++) {
			let car1 = cars[index1];
			for (let index2 = index1 + 1; index2 < cars.length; index2++) {
				let car2 = cars[index2];
				if (car1.testOverlap(car2)) {
					car1.setAnimation("Colliding");
					car2.setAnimation("Colliding");
					let [vx1, vy1, vx2, vy2] = car_collision_resolution(car1, car2, runtime);
					//car1.x -= car1.behaviors.Car.vectorX * dt;
					//car1.y -= car1.behaviors.Car.vectorY * dt;
					car1.behaviors.Car.setImpulse(vx1, vy1);
					car1.behaviors.Car.setVector(vx1, vy1);
					console.log("Delta for car 1: ", (vx1 - car1.behaviors.Car.vectorX), (vy1 - car1.behaviors.Car.vectorY))
					//car2.behaviors.Car.vectorX = vx2;
					//car2.behaviors.Car.vectorY = vy2;
					//car2.x -= car2.behaviors.Car.vectorX * dt;
					//car2.y -= car2.behaviors.Car.vectorY * dt;
					car2.behaviors.Car.setVector(vx2, vy2);
					car2.behaviors.Car.setImpulse(vx2, vy2);
				} else {
					car1.setAnimation("NoColliding");
					car2.setAnimation("NoColliding");
				}
			}
		}
	}
}
