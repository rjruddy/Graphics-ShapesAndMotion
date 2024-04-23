//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda AND
// Chapter 2: ColoredPoints.js (c) 2012 matsuda
// ControlMulti.js (c) Professor Jack Tumblin
//
// merged and modified to became:
//
// Project A by Rachel Ruddy

//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
 `uniform mat4 u_MvpMatrix;
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  varying vec4 v_Color;
  void main() {
    gl_Position = u_MvpMatrix * a_Position;
    gl_PointSize = 10.0;
    v_Color = a_Color;
  }`

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
 `precision mediump float;
  varying vec4 v_Color;
  void main() {
    gl_FragColor = v_Color;
  }`

// Global Variables
//------------For WebGL-----------------------------------------------
var gl;           // webGL Rendering Context. Set in main(), used everywhere.
var g_canvas = document.getElementById('webgl');     
                  // our HTML-5 canvas object that uses 'gl' for drawing.
                  
// ----------For Shapes & Matrices---------------------------------
var g_vertsMax = 0;                 // number of vertices held in the VBO 
                                    // (global: replaces local 'n' variable)
var g_MvpMatrix = new Matrix4();  // Construct 4x4 matrix; contents get sent
                                    // to the GPU/Shaders as a 'uniform' var.
var g_mvpMatLoc;                  // that uniform's location in the GPU

//------------For Animation---------------------------------------------
var g_isRun = true;                 // run/stop for animation; used in tick().
var g_lastMS = Date.now();    			// Timestamp for most-recently-drawn image; 
                                    // in milliseconds; used by 'animate()' fcn 
                                    // (now called 'timerAll()' ) to find time
                                    // elapsed since last on-screen image.
var g_angle01 = 0;                  // trunk rotation angle
var g_angle01Rate = 35.0;           // rotation speed, in degrees/second 
var g_angle02 = 0;                  // leaf rotation angle
var g_angle02Rate = 50.0;           // rotation speed, in degrees/second 
var g_angle03 = 0;
var g_angle03Rate = 70.0;
var g_angle04 = 0;
var g_angle04Rate = 40.0;
var g_posn02 = 0;                  // leaf position
var g_posn02Rate = 0.5;           // movement speed
var g_scaleMod = 1.0;					// scale of traveling assembly
var g_scaleModRate = 0.05;				//change rate of z_posn of traveling assembly

//------------For viewport controlling: -------------------------------
var eye_x = 7;
var eye_y = 7;
var eye_z = 3;
var tilt = -0.25;
var tiltRate = 0.02;
var theta = 179.9;
var thetaRate = 0.02;
var velocity = 0.05;

//storing aim point just to avoid recalculation.
var aim_x = 0;
var aim_y = 0;
var aim_z = tilt;

//------------For mouse click-and-drag: -------------------------------
var g_isDrag=false;		// mouse-drag: true when user holds down mouse button
var g_xMclik=0.0;			// last mouse button-down position (in CVV coords)
var g_yMclik=0.0;   
var g_xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var g_yMdragTot=0.0; 
var g_digits=5;			// DIAGNOSTICS: # of digits to print in console.log (
									//    console.log('xVal:', xVal.toFixed(g_digits)); // print 5 digits

var qNew = new Quaternion(0,0,0,1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();				// rotation matrix, made from latest qTot
								

function main() {
//==============================================================================
  
  // Get gl, the rendering context for WebGL, from our 'g_canvas' object
  gl = getWebGLContext(g_canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

// 	// THE 'REVERSED DEPTH' PROBLEM:=======================================
// 		// IF we don't transform our vertices by a 3D Camera Projection Matrix
// 		// (and we don't -- not until Project B) then the GPU will compute reversed 
// 		// depth values: depth==0 for vertex z == -1; depth==1 for vertex z== +1. 
// 		// Enabling the GPU's 'depth buffer' then causes strange-looking pictures!
// 		// To correct the 'REVERSED DEPTH' problem, we will
// 		// reverse the depth-buffer's *usage* of its computed depth values, like this:
  gl.enable(gl.DEPTH_TEST); // enabled by default, but let's be SURE.
//   gl.clearDepth(0.0); // each time we 'clear' our depth buffer, set all
// 		// pixel depths to 0.0 (1.0 is DEFAULT)
//   gl.depthFunc(gl.GREATER); // (gl.LESS is DEFAULT; reverse it!)
// 		// draw a pixel only if its depth value is GREATER
// 		// than the depth buffer's stored value.
	//=====================================================================

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Initialize a Vertex Buffer in the graphics system to hold our vertices
  g_maxVerts = initVertexBuffer(gl);  
  if (g_maxVerts < 0) {
    console.log('Failed to set the vertex information');
    return;
  }
  // KEYBOARD:
	window.addEventListener("keydown", myKeyDown, false);
	window.addEventListener("keyup", myKeyUp, false);

	// MOUSE:
	window.addEventListener("mousedown", myMouseDown); 
	// (After each 'mousedown' event, browser calls the myMouseDown() fcn.)
  window.addEventListener("mousemove", myMouseMove); 
	window.addEventListener("mouseup", myMouseUp);	

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.3, 0.4, 1.0);

	// // NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// // unless the new Z value is closer to the eye than the old one..
	// gl.depthFunc(gl.LESS);
	// gl.enable(gl.DEPTH_TEST); 	  
	
  // Get handle to graphics system's storage location of model, view, proj matrices
  g_mvpMatLoc = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
  if (!g_mvpMatLoc) { 
    console.log('Failed to get the storage location of u_MvpMatrix');
    return;
  }

  // ANIMATION: create 'tick' variable whose value is this function:
  //----------------- 
  var tick = function() {
    animate();   // Update the rotation angle
    drawResize();   // Draw all parts
    requestAnimationFrame(tick, g_canvas);   
    									// Request that the browser re-draw the webpage
    									// (causes webpage to endlessly re-draw itself)
  };
  tick();							// start (and continue) animation: draw current image
	
}

function initVertexBuffer() {
//==============================================================================
// NOTE!  'gl' is now a global variable -- no longer needed as fcn argument!

  var c30 = Math.sqrt(3) / 2;								 

  var myShapes = new Float32Array([
  // Vertex coordinates(x,y,z,w) and color (R,G,B) for a color hexagonal prism:
	//from bottom to top
	//Nodes 1-7: bottom of prism (pointing down)
	//Nodes 8-14: top of prism (pointing down/in)
		//BOTTOM TRIANGLES -- 18 vertices DONE
		0.0, -1.0, 0.0, 1.0,		1.0, 0.0, 0.0,  //bottom center NODE 1
		-0.5, -0.5, -c30, 1.0,		0.0, 1.0, 0.0,  //NODE 2
		0.5, -0.5, -c30, 1.0,		0.0, 0.0, 1.0,  //NODE 3

		0.0, -1.0, 0.0, 1.0,		1.0, 0.0, 0.0,  //bottom center NODE 1
		0.5, -0.5, -c30, 1.0,		0.0, 0.0, 1.0,  //NODE 3
		1.0, -0.5, 0.0, 1.0,		0.0, 1.0, 0.0,  //NODE 4

		0.0, -1.0, 0.0, 1.0, 		1.0, 0.0, 0.0,  //bottom center NODE 1
		1.0, -0.5, 0.0, 1.0,		0.0, 1.0, 0.0,  //NODE 4
		0.5, -0.5, c30, 1.0,		0.0, 0.0, 1.0,  //NODE 5

		0.0, -1.0, 0.0, 1.0,		1.0, 0.0, 0.0,  //bottom center NODE 1
		0.5, -0.5, c30, 1.0,		0.0, 0.0, 1.0,  //NODE 5
		-0.5, -0.5, c30, 1.0,		0.0, 1.0, 0.0,  //NODE 6

		0.0, -1.0, 0.0, 1.0,		1.0, 0.0, 0.0,  //bottom center NODE 1
		-0.5, -0.5, c30, 1.0,		0.0, 1.0, 0.0,  //NODE 6
		-1.0, -0.5, 0.0, 1.0,		0.0, 0.0, 1.0,  //NODE 7 

		0.0, -1.0, 0.0, 1.0,		1.0, 0.0, 0.0,  //bottom center NODE 1
		-1.0, -0.5, 0.0, 1.0,		0.0, 0.0, 1.0,  //NODE 7 
		-0.5, -0.5, -c30, 1.0,		0.0, 1.0, 0.0,  //NODE 2


		// WALLS -- 36 vertices
		-0.5, -0.5, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 2 /d
		0.5, -0.5, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 3 /d
		-0.5, 1.0, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 8 /d
		-0.5, 1.0, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 8 /d
		0.5, -0.5, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 3 /d
		0.5, 1.0, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 9 /d

		0.5, 1.0, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 9 /d
		0.5, -0.5, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 3 /d
		1.0, -0.5, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 4 /d
		1.0, -0.5, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 4 /d
		1.0, 1.0, 0.0, 1.0,			0.0, 0.0, 1.0, //NODE 10 /d
		0.5, 1.0, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 9 /d

		1.0, 1.0, 0.0, 1.0, 		0.0, 0.0, 1.0, //NODE 10 /d
		1.0, -0.5, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 4 /d
		0.5, -0.5, c30, 1.0,		0.0, 0.0, 1.0, //NODE 5 /d
		0.5, -0.5, c30, 1.0,		0.0, 0.0, 1.0, //NODE 5 /d
		0.5, 1.0, c30, 1.0,			0.0, 1.0, 0.0, //NODE 11 /d
		1.0, 1.0, 0.0, 1.0,			0.0, 0.0, 1.0, //NODE 10 /d

		0.5, 1.0, c30, 1.0,			0.0, 1.0, 0.0, //NODE 11 /d
		0.5, -0.5, c30, 1.0,		0.0, 0.0, 1.0, //NODE 5 /d
		-0.5, -0.5, c30, 1.0,		0.0, 1.0, 0.0, //NODE 6 /d
		-0.5, -0.5, c30, 1.0,		0.0, 1.0, 0.0, //NODE 6 /d
		-0.5, 1.0, c30,	1.0,		0.0, 0.0, 1.0, //NODE 12 /d
		0.5, 1.0, c30, 1.0,			0.0, 1.0, 0.0, //NODE 11 /d

		-0.5, -0.5, c30, 1.0,		0.0, 1.0, 0.0, //NODE 6 /d
		-1.0, -0.5, 0.0, 1.0,		0.0, 0.0, 1.0, //NODE 7 /d
		-0.5, 1.0, c30, 1.0,		0.0, 0.0, 1.0, //NODE 12 /d
		-0.5, 1.0, c30,	1.0,		0.0, 0.0, 1.0, //NODE 12 /d
		-1.0, -0.5, 0.0, 1.0,		0.0, 0.0, 1.0, //NODE 7 /d
		-1.0, 1.0, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 13 /d

		-1.0, -0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //NODE 7 /d
		-0.5, -0.5, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 2 /d
		-1.0, 1.0, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 13 /d
		-1.0, 1.0, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 13 /d
		-0.5, -0.5, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 2 /d
		-0.5, 1.0, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 8 /d


		//TOP TRIANGLES -- 18 vertices
		0.0, 0.5, 0.0, 1.0,			1.0, 0.0, 0.0, //top center NODE 14 /d -- triangle point
		-0.5, 1.0, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 8 /d
		0.5, 1.0, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 9 /d

		0.0, 0.5, 0.0, 1.0, 		1.0, 0.0, 0.0, //top center NODE 14 /d
		0.5, 1.0, -c30, 1.0,		0.0, 1.0, 0.0, //NODE 9 /d
		1.0, 1.0, 0.0, 1.0,			0.0, 0.0, 1.0, //NODE 10 /d

		0.0, 0.5, 0.0, 1.0, 		1.0, 0.0, 0.0, //top center NODE 14 /d
		1.0, 1.0, 0.0, 1.0,			0.0, 0.0, 1.0, //NODE 10 /d
		0.5, 1.0, c30, 1.0,			0.0, 1.0, 0.0, //NODE 11 /d

		0.0, 0.5, 0.0, 1.0,			1.0, 0.0, 0.0, //top center NODE 14 /d
		0.5, 1.0, c30, 1.0,			0.0, 1.0, 0.0, //NODE 11 /d
		-0.5, 1.0, c30, 1.0,		0.0, 0.0, 1.0, //NODE 12 /d

		0.0, 0.5, 0.0, 1.0,			1.0, 0.0, 0.0, //top center NODE 14 /d
		-0.5, 1.0, c30,	1.0,		0.0, 0.0, 1.0, //NODE 12 /d
		-1.0, 1.0, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 13 /d

		0.0, 0.5, 0.0, 1.0,			1.0, 0.0, 0.0, //top center NODE 14 /d
		-1.0, 1.0, 0.0, 1.0,		0.0, 1.0, 0.0, //NODE 13 /d
		-0.5, 1.0, -c30, 1.0,		0.0, 0.0, 1.0, //NODE 8 /d


	//NEW SHAPE
		0.0, -0.5, 1.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 1
		-1.0, -0.5, 0.0, 1.0, 		0.2, 0.7, 0.2, //ANODE 2
		0.0, -1.0, 0.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 0 PEAK

		0.0, -1.0, 0.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 0 PEAK
		-1.0, -0.5, 0.0, 1.0, 		0.2, 0.7, 0.2, //ANODE 2
		0.0, -0.5, -1.0, 1.0, 		0.6, 1.0, 1.0, //ANODE 3

		0.0, -1.0, 0.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 0 PEAK
		0.0, -0.5, -1.0, 1.0, 		0.6, 1.0, 1.0, //ANODE 3
		1.0, -0.5, 0.0, 1.0, 		0.6, 0.8, 0.5, //ANODE 4

		0.0, -1.0, 0.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 0 PEAK
		1.0, -0.5, 0.0, 1.0, 		0.6, 0.8, 0.5, //ANODE 4
		0.0, -0.5, 1.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 1


		0.0, -0.5, 1.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 1
		-1.0, -0.5, 0.0, 1.0, 		0.2, 0.7, 0.2, //ANODE 2
		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5

		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6
		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5
		-1.0, -0.5, 0.0, 1.0, 		0.2, 0.7, 0.2, //ANODE 2

		-1.0, -0.5, 0.0, 1.0, 		0.2, 0.7, 0.2, //ANODE 2
		0.0, -0.5, -1.0, 1.0, 		0.6, 1.0, 1.0, //ANODE 3
		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6

		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7
		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6
		0.0, -0.5, -1.0, 1.0, 		0.6, 1.0, 1.0, //ANODE 3

		0.0, -0.5, -1.0, 1.0, 		0.6, 1.0, 1.0, //ANODE 3
		1.0, -0.5, 0.0, 1.0, 		0.6, 0.8, 0.5, //ANODE 4
		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7

		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8
		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7
		1.0, -0.5, 0.0, 1.0, 		0.6, 0.8, 0.5, //ANODE 4

		1.0, -0.5, 0.0, 1.0, 		0.6, 0.8, 0.5, //ANODE 4
		0.0, -0.5, 1.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 1
		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8

		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5
		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8
		0.0, -0.5, 1.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 1

		//10, 9, 6
		0.0, 0.5, -1.0, 1.0, 		1.0, 0.0, 0.0, //ANODE 10
		-1.0, 0.5, 0.0, 1.0, 		0.0, 1.0, 0.0, //ANODE 9
		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6
		//6, 7, 10,
		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6
		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7
		0.0, 0.5, -1.0, 1.0, 		1.0, 0.0, 0.0, //ANODE 10
		//11, 10, 7
		1.0, 0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 11
		0.0, 0.5, -1.0, 1.0, 		1.0, 0.0, 0.0, //ANODE 10
		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7
		//7, 8, 11
		1.0, 0.0, -1.0, 1.0, 		0.0, 1.0, 1.0, //ANODE 7
		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8
		1.0, 0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 11
		//12, 11, 8
		0.0, 0.5, 1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 12
		1.0, 0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 11
		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8
		//8, 5, 12
		1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 8
		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5
		0.0, 0.5, 1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 12
		//9, 12, 5
		-1.0, 0.5, 0.0, 1.0, 		0.0, 1.0, 0.0, //ANODE 9
		0.0, 0.5, 1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 12
		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5
		//5, 6, 9
		-1.0, 0.0, 1.0, 1.0, 		1.0, 1.0, 0.0, //ANODE 5
		-1.0, 0.0, -1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 6
		-1.0, 0.5, 0.0, 1.0, 		0.0, 1.0, 0.0, //ANODE 9

		//12, 9, 13
		0.0, 0.5, 1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 12
		-1.0, 0.5, 0.0, 1.0, 		0.0, 1.0, 0.0, //ANODE 9
		0.0, 1.0, 0.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 13
		//9, 10, 13
		-1.0, 0.5, 0.0, 1.0, 		0.0, 1.0, 0.0, //ANODE 9
		0.0, 0.5, -1.0, 1.0, 		1.0, 0.0, 0.0, //ANODE 10
		0.0, 1.0, 0.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 13
		//10, 11, 13
		0.0, 0.5, -1.0, 1.0, 		1.0, 0.0, 0.0, //ANODE 10
		1.0, 0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 11
		0.0, 1.0, 0.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 13
		//11, 12, 13
		1.0, 0.5, 0.0, 1.0, 		0.0, 0.0, 1.0, //ANODE 11
		0.0, 0.5, 1.0, 1.0, 		1.0, 0.0, 1.0, //ANODE 12
		0.0, 1.0, 0.0, 1.0, 		1.0, 1.0, 1.0, //ANODE 13
  ]);

  myAxes = new Float32Array([
		// Drawing Axes: Draw them using gl.LINES drawing primitive;
     	// +x axis RED; +y axis GREEN; +z axis BLUE; origin: GRAY
		 0.0,  0.0,  0.0, 1.0,		0.3,  0.3,  0.3,	// X axis line (origin: gray)
		 1.3,  0.0,  0.0, 1.0,		1.0,  0.3,  0.3,	// 						 (endpoint: red)
		 
		 0.0,  0.0,  0.0, 1.0,    0.3,  0.3,  0.3,	// Y axis line (origin: white)
		 0.0,  1.3,  0.0, 1.0,		0.3,  1.0,  0.3,	//						 (endpoint: green)

		 0.0,  0.0,  0.0, 1.0,		0.3,  0.3,  0.3,	// Z axis line (origin:white)
		 0.0,  0.0,  1.3, 1.0,		0.3,  0.3,  1.0,	//						 (endpoint: blue)
  ])

  //need to combine ground grid into colorShapes

  makeGroundGrid();	
  // 72 modified hexagonal prism vertices. and 72 twist shape vertices
  var numFloats = myShapes.length + gndVerts.length + myAxes.length;
  g_vertsMax = numFloats / 7; //7 floats per vertex: x, y, z, w, r, g, b
  // Create a buffer object

  //TODO: Merge myShapes and gndVerts into a larger colorShapes array
  var colorShapes = new Float32Array(numFloats);
  for(i=0, j=0; j< myShapes.length; i++, j++) {
	colorShapes[i] = myShapes[j];
	}
  gndStart = i;						//store the ground-plane
  for(j=0; j< gndVerts.length; i++, j++) {
	colorShapes[i] = gndVerts[j];
  }
  myAxesStart = i;						//store the ground-plane
  for(j=0; j< myAxes.length; i++, j++) {
	colorShapes[i] = myAxes[j];
  }


  var shapeBufferHandle = gl.createBuffer();  
  if (!shapeBufferHandle) {
    console.log('Failed to create the shape buffer object');
    return false;
  }

  // Bind the the buffer object to target:
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
  // Transfer data from Javascript array colorShapes to Graphics system VBO
  // (Use sparingly--may be slow if you transfer large shapes stored in files)
  gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);

  var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?
    
  //Get graphics system's handle for our Vertex Shader's position-input variable: 
  var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return -1;
  }
  // Use handle to specify how to retrieve position data from our VBO:
  gl.vertexAttribPointer(
  		a_Position, 	// choose Vertex Shader attribute to fill with data
  		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
  		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
  		false, 				// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * 7, 		// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		0);						// Offset -- now many bytes from START of buffer to the
  									// value we will actually use?
  gl.enableVertexAttribArray(a_Position);  
  									// Enable assignment of vertex buffer object's position data

  // Get graphics system's handle for our Vertex Shader's color-input variable;
  var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  if(a_Color < 0) {
    console.log('Failed to get the storage location of a_Color');
    return -1;
  }
  // Use handle to specify how to retrieve color data from our VBO:
  gl.vertexAttribPointer(
  	a_Color, 				// choose Vertex Shader attribute to fill with data
  	3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
  	gl.FLOAT, 			// data type for each value: usually gl.FLOAT
  	false, 					// did we supply fixed-point data AND it needs normalizing?
  	FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  	FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
  									// value we will actually use?  Need to skip over x,y,z,w
  									
  gl.enableVertexAttribArray(a_Color);  

  // Unbind the buffer object 
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function makeGroundGrid() {
	//==============================================================================
	// Create a list of vertices that create a large grid of lines in the x,y plane
	// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.
	
		var xcount = 100;			// # of lines to draw in x,y to make the grid.
		var ycount = 100;		
		var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
		 var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
		 var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
		 var floatsPerVertex = 7; // number of floats in a given vertex; x, y, z, w, r, g, b
		 
		// Create an (global) array to hold this ground-plane's vertices:
		gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
							// draw a grid made of xcount+ycount lines; 2 vertices per line.
							
		var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
		var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
		
		// First, step thru x values as we make vertical lines of constant-x:
		for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
			if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
				gndVerts[j  ] = -xymax + (v  )*xgap;	// x
				gndVerts[j+1] = -xymax;								// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			else {				// put odd-numbered vertices at (xnow, +xymax, 0).
				gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
				gndVerts[j+1] = xymax;								// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			gndVerts[j+4] = xColr[0];			// red
			gndVerts[j+5] = xColr[1];			// grn
			gndVerts[j+6] = xColr[2];			// blu
		}
		// Second, step thru y values as wqe make horizontal lines of constant-y:
		// (don't re-initialize j--we're adding more vertices to the array)
		for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
			if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
				gndVerts[j  ] = -xymax;								// x
				gndVerts[j+1] = -xymax + (v  )*ygap;	// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			else {					// put odd-numbered vertices at (+xymax, ynow, 0).
				gndVerts[j  ] = xymax;								// x
				gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
				gndVerts[j+2] = 0.0;									// z
				gndVerts[j+3] = 1.0;									// w.
			}
			gndVerts[j+4] = yColr[0];			// red
			gndVerts[j+5] = yColr[1];			// grn
			gndVerts[j+6] = yColr[2];			// blu
		}
}

function drawAll() {
//==============================================================================
  // Clear <canvas>  colors AND the depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	clrColr = new Float32Array(4);
	clrColr = gl.getParameter(gl.COLOR_CLEAR_VALUE);
	// console.log("clear value:", clrColr);


  //VIEWPORT STUFF
  //----------------------Camera control notes------------------------
  //user keys (e.g. WASD) adjust compass heading (theta) in world coords, and 
  // delta_z (tilt above/below horizon), and arrow keys move you fwd/rev in 
  // camera aiming direction, with left/right arrows to 'strafe' left/right.
  //- to move/displace camera without ‘steering’ you must:
  	//add displacement to **both** the eyepoint and the look-at point
  	//BIG HINT:
	  	//store only `Eye`, `theta`, and `tilt`!
		//compute `aim` when needed — consider it locked to your eyepoint, and close by
	//compute just the tilt and theta values, and have the WASD adjust where your eye goes
	//don’t have one set of controls for eyepoint and one set of controls for aimpoint — have user controlls set just the eyepoint, theta, and delta tilt, and then YOU compute the aimpoint from that!
		//$aim_x = eye_x + cos(theta)$
		//$aim_y = eye_y + sin(theta)$
		//$aim_z = eye_z + delta(tilt)$
	//delta tilt is change up and down z
	aim_x = eye_x + Math.cos(theta);
	aim_y = eye_y + Math.sin(theta);
	aim_z = eye_z + tilt;

	var far = 30
	var near = 1

//----------------------LEFT viewport: Perspective------------------------
  gl.viewport(0,							// Viewport lower-left corner
			0, 								// location(in pixels)
			g_canvas.width/2, 				// viewport width,
			g_canvas.height);				// viewport height in pixels.
  //set identity
  var vpAspect = (g_canvas.width / 2) / (g_canvas.height);	// aspect ratio: width/height.
  g_MvpMatrix.setIdentity();

  //TODO: Create projection matrix

  var projMatrix = new Matrix4(); //Perspective(FOVY, aspect_ratio, zNear, zFar)
  projMatrix.perspective(35, vpAspect, near, far); 
  var viewMatrix = new Matrix4(); //lookAt(projection_center, look_at, up)
  viewMatrix.setLookAt(eye_x, eye_y, eye_z,
						aim_x, aim_y, aim_z,
						0, 0, 1);
  g_MvpMatrix.set(projMatrix).multiply(viewMatrix); // from book code example

  pushMatrix(g_MvpMatrix);
	drawWorld();
  g_MvpMatrix = popMatrix();

//----------------------RIGHT viewport: Orthographic------------------------
  gl.viewport(g_canvas.width/2,			// Viewport lower-left corner
			0, 							// location(in pixels)
			g_canvas.width/2, 			// viewport width,
			g_canvas.height);			// viewport height in pixels.
  //set identity
  //var vpAspect = (g_canvas.width / 2) / (g_canvas.height);	// aspect ratio: width/height.
//   vpAspect = (g_canvas.width / 2) / (g_canvas.height * (2 / 3));
  g_MvpMatrix.setIdentity();

  //TODO: Create projection matrix
  var fovInRad = 35 * (Math.PI / 180);
  var height = ((far - near) / 3) * Math.tan(fovInRad);
//   console.log("Math.pi: ", Math.pi)
//   console.log("Fov in radians: ", fovInRad, " and height: ", height);

//   console.log("Left: ", -(vpAspect * height),
//   				"Right: ", (vpAspect * height),
// 				"Bottom: ", -height,
// 				"Top: ", height,
// 				"Near: ", near,
// 				"Far: ", far);
  var projMatrix = new Matrix4(); //Ortho(Left, Right, Bottom, Top, Near, Far)
  projMatrix.ortho(-(vpAspect * height), 
					(vpAspect * height), //(vpAspect * height)
					-height,
					height,
					near,
					far); 
//   projMatrix.ortho(-1, 
// 					1, //(vpAspect * height)
// 					-1,
// 					1,
// 					near,
// 					far); 
  //
  var viewMatrix = new Matrix4(); //lookAt(projection_center, look_at, up)
  viewMatrix.setLookAt(eye_x, eye_y, eye_z,
						aim_x, aim_y, aim_z,
						0, 0, 1);
  g_MvpMatrix.set(projMatrix).multiply(viewMatrix); // from book code example

  pushMatrix(g_MvpMatrix);
	drawWorld();
  g_MvpMatrix = popMatrix();

}

function drawTrunk() {
	gl.uniformMatrix4fv(g_mvpMatLoc, false, g_MvpMatrix.elements)
	gl.drawArrays(gl.TRIANGLES, 0, 72);
}

function drawLeaf() {
	gl.uniformMatrix4fv(g_mvpMatLoc, false, g_MvpMatrix.elements)
	gl.drawArrays(gl.TRIANGLES, 72, 72);
}

function drawGrid() {
	gl.uniformMatrix4fv(g_mvpMatLoc, false, g_MvpMatrix.elements)
	gl.drawArrays(gl.LINES, 144, gndVerts.length / 7);
}

function drawAxes() {
	gl.uniformMatrix4fv(g_mvpMatLoc, false, g_MvpMatrix.elements)
	gl.drawArrays(gl.LINES, 144 + (gndVerts.length / 7), myAxes.length / 7);
}

function drawWorld() {
	pushMatrix(g_MvpMatrix);
		//TREE TRUNK
		g_MvpMatrix.rotate(90, 1, 0, 0);
		g_MvpMatrix.translate(-1, 1, 0);

		pushMatrix(g_MvpMatrix);

			//-------Draw base prism
			g_MvpMatrix.scale(0.2, 0.2, 0.2);
			//for trunk swaying, need to rotate over both x and z axes (diagonal sway)
			g_MvpMatrix.rotate(g_angle01, -1, 0, 1); //MOTION
			drawTrunk();
			pushMatrix(g_MvpMatrix);

				//draw secondary trunk part
				g_MvpMatrix.translate(0.0, 1.5, 0.0);
				g_MvpMatrix.scale(0.75, 0.75, 0.75);
				g_MvpMatrix.rotate(g_angle01, -1, 0, 1); //MOTION
				drawTrunk();
				pushMatrix(g_MvpMatrix);

					//draw tertiary trunk part (highest level)
					g_MvpMatrix.translate(0.0, 1.5, 0.0);
					g_MvpMatrix.scale(0.75, 0.75, 0.75);
					g_MvpMatrix.rotate(g_angle01, -1, 0, 1); //MOTION
					drawTrunk();

					pushMatrix(g_MvpMatrix);
						g_MvpMatrix.rotate(g_angle03, 0, 1, 0);
						pushMatrix(g_MvpMatrix);

							//draw the leaves!!!
							g_MvpMatrix.scale(1.5, 0.5, 0.5);
							g_MvpMatrix.translate(0.0, 3.0, 1.5);
							g_MvpMatrix.rotate(90, 0, 0, 1);
							drawLeaf();
						
							g_MvpMatrix = popMatrix();

						pushMatrix(g_MvpMatrix);

							//draw the leaves!!!
							g_MvpMatrix.scale(1.5, 0.5, 0.5);
							g_MvpMatrix.translate(0.0, 3.0, -1.5);
							g_MvpMatrix.rotate(90, 0, 0, 1);
							drawLeaf();
						
						g_MvpMatrix = popMatrix();
					g_MvpMatrix = popMatrix();

				g_MvpMatrix = popMatrix();
			g_MvpMatrix = popMatrix();
		g_MvpMatrix = popMatrix();
	g_MvpMatrix = popMatrix();

	//ASSEMBLY 2
	pushMatrix(g_MvpMatrix);

		g_MvpMatrix.translate(1, 1, 1);
		g_MvpMatrix.scale(0.2, 0.2, 0.2);
		g_MvpMatrix.rotate(-45, 0, 0, 1);
		quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
		g_MvpMatrix.concat(quatMatrix);	// apply that matrix.
		pushMatrix(g_MvpMatrix);
			// g_MvpMatrix.scale(g_scaleMod, g_scaleMod, g_scaleMod);
			g_MvpMatrix.translate(0, g_posn02, 0);

			pushMatrix(g_MvpMatrix);
				g_MvpMatrix.scale(2, 2, 2);
				drawAxes();
			g_MvpMatrix = popMatrix();

			//perp-axis rotation:
			// var dist = Math.sqrt(g_xMdragTot*g_xMdragTot + g_yMdragTot*g_yMdragTot);
			// g_MvpMatrix.rotate(dist*120.0, -g_yMdragTot+0.0001, g_xMdragTot+0.0001, 0.0); //g_xMdragTot+0.0001
			// quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
			// g_MvpMatrix.concat(quatMatrix);	// apply that matrix.
			drawLeaf();

			pushMatrix(g_MvpMatrix);

				g_MvpMatrix.translate(0.0, 2.0, 0.0);
				g_MvpMatrix.rotate(g_angle02, 0, 1, 0);
				drawLeaf();

			g_MvpMatrix = popMatrix();

			pushMatrix(g_MvpMatrix);

			g_MvpMatrix.translate(0.0, -2.0, 0.0);
			g_MvpMatrix.rotate(-g_angle02, 0, 1, 0);
			drawLeaf();

			g_MvpMatrix = popMatrix();

		g_MvpMatrix = popMatrix();
	g_MvpMatrix = popMatrix();

	//ASSEMBLY 3
	pushMatrix(g_MvpMatrix);
		g_MvpMatrix.rotate(g_angle02*0.5, 0, 0, 1);
		g_MvpMatrix.translate(2, 2, 1);
		g_MvpMatrix.rotate(90, 0, 0, 1);
		g_MvpMatrix.scale(0.4, 0.4, 0.4);
		drawTrunk();
		pushMatrix(g_MvpMatrix);

			g_MvpMatrix.translate(0, -1.3, 0);
			g_MvpMatrix.scale(0.2, 0.3, 0.2);
			g_MvpMatrix.rotate(90, 1, 0, 0);
			// g_MvpMatrix.translate(0, -0.5, 0);
			g_MvpMatrix.rotate(g_angle04, 1, 0, 1);
			drawLeaf();

			pushMatrix(g_MvpMatrix);

				g_MvpMatrix.translate(0, 0, 2);
				g_MvpMatrix.rotate(g_angle04, 1, 0, 1);
				drawLeaf();

				pushMatrix(g_MvpMatrix);

					g_MvpMatrix.translate(0, 0, 2);
					g_MvpMatrix.rotate(g_angle04, 1, 0, 1);
					drawLeaf();

					pushMatrix(g_MvpMatrix);

						g_MvpMatrix.translate(0, 0, 2);
						g_MvpMatrix.rotate(g_angle04, 1, 0, 1);
						drawLeaf();

						pushMatrix(g_MvpMatrix);

							g_MvpMatrix.translate(0, 0, 2);
							g_MvpMatrix.rotate(90, 1, 0, 0);
							g_MvpMatrix.rotate(g_angle04, 1, 0, 1);
							drawTrunk();
		
						g_MvpMatrix = popMatrix();

					g_MvpMatrix = popMatrix();

				g_MvpMatrix = popMatrix();

			g_MvpMatrix = popMatrix();

		g_MvpMatrix = popMatrix();
	g_MvpMatrix = popMatrix();

	//ASSEMBLY 4
	pushMatrix(g_MvpMatrix);
		g_MvpMatrix.translate(-7, -7, 1);
		g_MvpMatrix.scale(0.7, 0.7, 2);
		drawLeaf();

		pushMatrix(g_MvpMatrix);
			g_MvpMatrix.translate(0, 1, 0);
			g_MvpMatrix.scale(0.5, 0.5, 0.5);
			drawLeaf();

		g_MvpMatrix = popMatrix();

		pushMatrix(g_MvpMatrix);
			g_MvpMatrix.translate(0, -1, 0);
			g_MvpMatrix.scale(0.5, 0.5, 0.5);
			drawLeaf();

		g_MvpMatrix = popMatrix();

	g_MvpMatrix = popMatrix();

	//ASSEMBLY 5 TODO
	pushMatrix(g_MvpMatrix);

		g_MvpMatrix.translate(5, 2, 1);
		g_MvpMatrix.scale(0.2, 0.2, 0.2);
		drawLeaf();

		pushMatrix(g_MvpMatrix);

			g_MvpMatrix.translate(0, 0, 1);
			drawTrunk();

		g_MvpMatrix = popMatrix();

	g_MvpMatrix = popMatrix();

	//WORLD AXES
	pushMatrix(g_MvpMatrix);

		g_MvpMatrix.translate(0, -1, 1.5);
		// g_MvpMatrix.scale(3, 3, 3)
		drawAxes();

	g_MvpMatrix = popMatrix();

	//GRID 
	pushMatrix(g_MvpMatrix);

		g_MvpMatrix.scale(0.2, 0.2, 0.2);
		drawGrid();

	g_MvpMatrix = popMatrix();

}

function drawResize() {
	//==============================================================================
	// Called when user re-sizes their browser window , because our HTML file
	// contains:  <body onload="main()" onresize="winResize()">
	
		//Report our current browser-window contents:
	
	// 	console.log('g_Canvas width,height=', g_canvas.width, g_canvas.height);		
	//  console.log('Browser window: innerWidth,innerHeight=', 
	// 																innerWidth, innerHeight);	
	// 																// http://www.w3schools.com/jsref/obj_window.asp
	
		
		//Make canvas fill the top 3/4 of our browser window:
		var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
		g_canvas.width = innerWidth - xtraMargin;
		g_canvas.height = (innerHeight*3/4) - xtraMargin;
		g_canvas.aratio = g_canvas.width / g_canvas.height;
		// IMPORTANT!  Need a fresh drawing in the re-sized viewports.
		drawAll();				// draw in all viewports.
}

// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate() {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;
  
  // Update the current rotation angle (adjusted by the elapsed time)
  var swayDist = document.getElementById('swayDist').value; 

  g_angle01 = g_angle01 + (g_angle01Rate * elapsed) / 1000.0;
  if(g_angle01 >  swayDist && g_angle01Rate > 0) g_angle01Rate = -g_angle01Rate;
  if(g_angle01 < -swayDist && g_angle01Rate < 0) g_angle01Rate = -g_angle01Rate;

  g_angle02 = g_angle02 + (g_angle02Rate * elapsed) / 1000.0;

  g_angle04 = g_angle04 + (g_angle04Rate * elapsed) / 1000.0;
  if(g_angle04 >  60 && g_angle04Rate > 0) g_angle04Rate = -g_angle04Rate;
  if(g_angle04 < -60 && g_angle04Rate < 0) g_angle04Rate = -g_angle04Rate;

  g_posn02 = g_posn02 + (g_posn02Rate * elapsed) / 1000.0;
  if(g_posn02 > 1.0 && g_posn02Rate > 0) g_posn02Rate = -g_posn02Rate;
  if(g_posn02 < -1.0 && g_posn02Rate < 0) g_posn02Rate = -g_posn02Rate;

  g_angle03 = g_angle03 + (g_angle03Rate * elapsed) / 1000.0;

}

//==================HTML Button Callbacks======================

function runStop() {
// Called when user presses the 'Run/Stop' button
  //Stop the angle rotation:
  if(g_angle01Rate*g_angle01Rate > 1) {  // if nonzero rate,
    myTmp = g_angle01Rate;  // store the current rate,
    g_angle01Rate = 0;      // and set to zero.
  }
  else {    // but if rate is zero,
  	g_angle01Rate = myTmp;  // use the stored rate.
  }
  if(g_angle02Rate*g_angle02Rate > 1) {  // if nonzero rate,
    myTmp = g_angle02Rate;  // store the current rate,
    g_angle02Rate = 0;      // and set to zero.
  }
  else {    // but if rate is zero,
  	g_angle02Rate = myTmp;  // use the stored rate.
  }
}

//===================Mouse and Keyboard event-handling Callbacks

function myMouseDown(ev) {
//==============================================================================
// Called when user PRESSES down any mouse button;
// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
  var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
//	console.log('myMouseDown(CVV coords  ):  x, y=\t',x,',\t',y);
	
	g_isDrag = true;											// set our mouse-dragging flag
	g_xMclik = x;													// record where mouse-dragging began
	g_yMclik = y;
};


function myMouseMove(ev) {
//==============================================================================
// Called when user MOVES the mouse with a button already pressed down.
	if(g_isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'

  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);		// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										-1 <= y < +1.
							 (g_canvas.height/2);

	// find how far we dragged the mouse:
	g_xMdragTot += (x - g_xMclik);			// Accumulate change-in-mouse-position,&
	g_yMdragTot += (y - g_yMclik);

	dragQuat(x - g_xMclik, y - g_yMclik);

	g_xMclik = x;											// Make next drag-measurement from here.
	g_yMclik = y;
};

function myMouseUp(ev) {
//==============================================================================
// Called when user RELEASES mouse button pressed previously.
// 									(Which button?   console.log('ev.button='+ev.button);    )
// 		ev.clientX, ev.clientY == mouse pointer location, but measured in webpage 
//		pixels: left-handed coords; UPPER left origin; Y increases DOWNWARDS (!)  

// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
  var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
  var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = g_canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
//  console.log('myMouseUp  (pixel coords):\n\t xp,yp=\t',xp,',\t',yp);
  
	// Convert to Canonical View Volume (CVV) coordinates too:
  var x = (xp - g_canvas.width/2)  / 		// move origin to center of canvas and
  						 (g_canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - g_canvas.height/2) /		//										 -1 <= y < +1.
							 (g_canvas.height/2);
	console.log('myMouseUp  (CVV coords  ):\n\t x, y=\t',x,',\t',y);
	
	g_isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:

	// where each mouse-drag event creates a quaternion (qNew) that gets applied
	// to our current rotation qTot by quaternion-multiply.

	g_xMdragTot += (x - g_xMclik);
	g_yMdragTot += (y - g_yMclik);

	dragQuat(x - g_xMclik, y - g_yMclik);

	g_xMclik = x;			// Make NEXT drag-measurement from here.
	g_yMclik = y;

};

function dragQuat(xdrag, ydrag) {
	var qTmp = new Quaternion(0,0,0,1);
	
	var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
	// console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
	//this is where our fixes need to come:
		//when facing the object and rotating it vertically (towards or away from you), 
		//calculate the axis of rotation by constructing a perpendicular axis from your view
		//direction (given by theta). maybe use same logic as strafe?
		//meanwhile horizontal rotation is always about world Z axis
		aim_x = eye_x + Math.cos(theta);
		aim_y = eye_y + Math.sin(theta);
		aim_z = eye_z + tilt;
		var dirVecX = (eye_x + Math.cos(theta))-eye_x;
		var dirVecY = (eye_y + Math.sin(theta))-eye_y;
		var dirVecZ = (eye_z + tilt)-eye_z; //up vec -- 0, 0, 1
		var rotVecX = dirVecY*1 - dirVecZ*0;
		var rotVecY = (dirVecZ*0 - dirVecX*1);

	qNew.setFromAxisAngle(-ydrag*rotVecX + 0.0001, xdrag*rotVecY + 0.0001, xdrag, dist*150.0);
	qTmp.multiply(qNew,qTot);			// apply new rotation to current rotation. 
	//--------------------------
	qTot.copy(qTmp);
	// show the new quaternion qTot on our webpage in the <div> element 'QuatValue'
};

function myKeyDown(kev) {
//===============================================================================
  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
              "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
              "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);
 
	switch(kev.code) {
		case "KeyP":
			console.log("Pause/unPause!\n");                // print on console,
			document.getElementById('KeyDownResult').innerHTML =  
			'myKeyDown() found p/P key. Pause/unPause!';   // print on webpage
			if(g_isRun==true) {
			  g_isRun = false;    // STOP animation
			  }
			else {
			  g_isRun = true;     // RESTART animation
			  tick();
			  }
			break;
		//------------------WASD navigation-----------------
		case "KeyS": //down -- look down (decrease tilt)
			tilt -= tiltRate;
			break;
		case "KeyW": //up -- look up (increase tilt)
			tilt += tiltRate;
			break;
		case "KeyA": //left -- look left
			theta += thetaRate;
			break;
		case "KeyD": //right -- look right
			theta -= thetaRate;
			break;
		//----------------Arrow keys------------------------

		case "ArrowUp": //up -- move forward
			//eye point PLUS vector from eye to aim.
			//vector from eye to aim:
			eye_x += (aim_x - eye_x)*velocity;
			eye_y += (aim_y - eye_y)*velocity;
			eye_z += (aim_z - eye_z)*velocity;
			console.log("eye: ", eye_x, eye_y, eye_z, " aim: ", aim_x, aim_y, aim_z);
			break;
		case "ArrowDown": //down -- move backward
			eye_x -= (aim_x - eye_x)*velocity;
			eye_y -= (aim_y - eye_y)*velocity;
			eye_z -= (aim_z - eye_z)*velocity;
			break;
		case "ArrowLeft": //left -- strafe left
			// shift eyepoint vector sideways? how? shift by theta +/- 90º? 
			//cross product of direction vector with up vector!
			aim_x = eye_x + Math.cos(theta);
			aim_y = eye_y + Math.sin(theta);
			aim_z = eye_z + tilt;
			var dirVecX = aim_x-eye_x;
			var dirVecY = aim_y-eye_y;
			var dirVecZ = aim_z-eye_z; //v2: 0, 0, 1
			var strafeVecX = dirVecY*1 - dirVecZ*0;
			var strafeVecY = (dirVecZ*0 - dirVecX*1);
			var strafeVecZ = dirVecX*0 - dirVecY*0;
			eye_x -= strafeVecX*velocity;
			eye_y -= strafeVecY*velocity;
			eye_z -= strafeVecZ*velocity;
			break;
		case "ArrowRight": //right -- strafe right
			// shift eyepoint vector sideways? how?
			// eye_x += velocity*Math.sin(theta-90);
			aim_x = eye_x + Math.cos(theta);
			aim_y = eye_y + Math.sin(theta);
			aim_z = eye_z + tilt;
			var dirVecX = (eye_x + Math.cos(theta))-eye_x;
			var dirVecY = (eye_y + Math.sin(theta))-eye_y;
			var dirVecZ = (eye_z + tilt)-eye_z; //up vec -- 0, 0, 1
			var strafeVecX = dirVecY*1 - dirVecZ*0;
			var strafeVecY = (dirVecZ*0 - dirVecX*1);
			var strafeVecZ = dirVecX*0 - dirVecY*0;
			eye_x += strafeVecX*velocity;
			eye_y += strafeVecY*velocity;
			eye_z += strafeVecZ*velocity;
			break;
    default:
      console.log("UNUSED!");
      break;
	}
}

function crossVec(v1, v2) {
	var retvec = new Vector3();
	retvec[0] = v1[1]*v2[2] - v1[2]*v2[1];
	retvec[1] = -(v1[2]*v2[0] - v1[0]*v2[2]);
	retvec[2] = v1[0]*v2[1] - v1[1]*v2[0];
	return retvec;
}

function myKeyUp(kev) {
//===============================================================================
// Called when user releases ANY key on the keyboard; captures scancodes well

	console.log('myKeyUp()--keyCode='+kev.keyCode+' released.');
}