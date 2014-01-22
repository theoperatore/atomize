window.addEventListener("load", function(ev) {
  
	var canvas = document.getElementById("playground"),
    	ctx = canvas.getContext('2d'),
    	img = new Image(),
    	bg  = new Image(),
    	options = {
    		rows : 100,
    		cols : 100
    	},
    	bgLoaded = false,
    	sizeCols,
    	sizeRows,
    	pieces = [],
    	now,
    	prev = 0,
    	springStrength = 0.1,
    	rotationForce = 0.015,
    	gui = new dat.GUI(),
    	rS  = new rStats(),

    	//px / py is the x and y coords in the img space -- used for slicing
    	//x  / y  is the x and y coords in canvas space
    	Piece = function(px,py,sizeX,sizeY,x,y) {
    		this.imgX = px;
    		this.imgY = py;
    		this.x = x;
    		this.y = y;
    		this.sizeX = sizeX;
    		this.sizeY = sizeY;
    		this.dx = 0;
    		this.dy = 0;
    		this.mass = 1;
    		this.friction = 0.85;
    		this.projectedX = x;
    		this.projectedY = y;
    		this.originX = x;
    		this.originY = y;
    	};

	bg.addEventListener("load", function(ev) {
		bgLoaded = true;
	});

	img.addEventListener("load", function(ev) {

		var guiControllerRows,
			guiControllerCols;

		/* *******************************************************************************************************
		 *                                                                                                       *
		 * The scaling of the image is incorrect.                                                                *
		 * It seems that I am setting the sliced rectangle's x and y accoring to the unscaled image's x and y    *
		 *                                                                                                       *
		 * *******************************************************************************************************/

		function createPieces() {
			pieces.length = 0;

			sizeCols = canvas.width / options.cols;
			sizeRows = canvas.height / options.rows;

			for (var i = 0; i < options.cols; i++) {
				for (var j = 0; j < options.rows; j++) {
				
					//create a new piece to be used to draw
					pieces.push(new Piece( i*sizeCols, j*sizeRows, sizeCols, sizeRows, i * sizeCols, j* sizeRows));
				}
			}

			console.log('reallocating pieces...', pieces.length);
		};

		//setup event Listeners
		canvas.addEventListener('mousemove', function(ev) {
			var mouseX = ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
				mouseY = ev.clientY + document.body.scrollTop + document.documentElement.scrollTop;

			mouseX -= canvas.offsetLeft;
			mouseY -= canvas.offsetTop;

			for (var i = 0; i < pieces.length; i++) {

				var dx = mouseX - pieces[i].x,
					dy = mouseY - pieces[i].y,
					dd = (dx * dx) + (dy * dy);
					d  = Math.sqrt(dd);

				if (d <= 100) {
					pieces[i].projectedX = pieces[i].x - dx;
					pieces[i].projectedY = pieces[i].y - dy;
				}
				else {
					pieces[i].projectedX = pieces[i].originX;
					pieces[i].projectedY = pieces[i].originY;
				}
			}
		});

		//reset every piece when the mouse leaves the canvas
		canvas.addEventListener('mouseleave', function(ev) {
			for (var i = 0; i < pieces.length; i++) {
				pieces[i].projectedX = pieces[i].originX;
				pieces[i].projectedY = pieces[i].originY;
			}
		});

		//initialize
		createPieces();

		canvas.width = img.width;
		canvas.height = img.height;

		//setup DAT.GUI
		guiControllerRows = gui.add(options, "rows").min(1).max(100).step(1);
		guiControllerCols = gui.add(options, "cols").min(1).max(100).step(1);

		guiControllerRows.onChange(function(value) {
			options.rows = value;
			createPieces();
		});

		guiControllerCols.onChange(function(value) {
			options.cols = value;
			createPieces();
		});


		//start animation
		requestAnimationFrame(update);
	});

	function update(time) {

		//start profiling this frame
		rS('frame').start();
		rS('rAF').tick();
		rS('FPS').frame();

		//included in case velocity based on time is to be used
		now = +new Date;
		var dt = (prev === 0) ? 0 : now - prev;
		prev = now;

		//collision detection?

		rS('updateTime').start();
		//update pieces
		for (var i = 0; i < pieces.length; i++) {
			var dx,			//the distance between projectedX and currX of this particle
				dy,			//the distance between projectedY and currY of this particle
				impulseX,	//calculated force orthogonal to dx
				impulseY;	//calculated force orthogonal to dy


			//get the change in pos from where the piece is currently, and where it is projected to be
			dx = pieces[i].projectedX - pieces[i].x;
			dy = pieces[i].projectedY - pieces[i].y;

			//calculate spring impulses 
			impulseX = (dx * springStrength) - (dy * rotationForce);
			impulseY = (dy * springStrength) + (dx * rotationForce);

			//apply spring impulses
			pieces[i].dx += impulseX;
			pieces[i].dy += impulseY;

			//dampen velocity
			pieces[i].dx *= pieces[i].friction;
			pieces[i].dy *= pieces[i].friction;

			//update piece's new position
			pieces[i].x += pieces[i].dx;
			pieces[i].y += pieces[i].dy;

		}
		rS('updateTime').end();

		//profile drawing
		rS('render').start();
		draw();
		rS('render').end();

		//end this frame and update profile gui
		rS('frame').end();
		rS().update();


		requestAnimationFrame(update);
	}

	//called in the update method
	function draw() {
		ctx.clearRect(0,0,canvas.width,canvas.height);

		if (bgLoaded) {
			ctx.drawImage(bg,0,0, canvas.width, canvas.height);
		}

		for (var i = 0; i < pieces.length; i++) {

			/*
			 * 
			 * Params: img             -- the image to draw
			 *         pieces[i].imgX  -- the x-coord in image space to slice
			 *         pieces[i].imgY  -- the y-coord in image space to slice
			 *         pieces[i].sizeX -- the width of this piece
			 *         pieces[i].sizeY -- the height of this piece
			 *         pieces[i].x     -- the x-coord in canvas space to draw this slice
			 *         pieces[i].y     -- the y-coord in canvas space to draw this slice
			 *         pieces[i].sizeX -- using same width as slice; no scaling width
			 *         pieces[i].sizeY -- using same height as slice; no scaling height
			 */
			ctx.drawImage(img, pieces[i].imgX, pieces[i].imgY, pieces[i].sizeX, pieces[i].sizeY, pieces[i].x, pieces[i].y, pieces[i].sizeX, pieces[i].sizeY);
			//ctx.drawImage(img,0,0,img.width/2, img.height/2);
		}
	}

	//start loading the image and setup the app
	bg.src = "./sheep.jpg";
	img.src = "./turtle.jpg";
	//bg.src = "./turtle.jpg";
	//img.src = "./sheep.jpg";
});