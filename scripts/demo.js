window.addEventListener("load", function(ev) {
  
	var canvas = document.getElementById("playground"),
    	ctx = canvas.getContext('2d'),
    	img = new Image(),
    	bg  = new Image(),
    	options = {
    		rows : 100,
    		cols : 100,
    		rcHasChanged : false,
    		springStrength : 0.25,
    		rotationForce : 0.01,
    		dampen : 0.35
    	},
    	bgLoaded = false,
    	sizeCols,
    	sizeRows,
    	pieces = [],
    	mouseX,
    	mouseY,
    	now,
    	prev = 0,
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
    		this.projectedX = x;
    		this.projectedY = y;
    		this.originX = x;
    		this.originY = y;
    	};

    //try some canvas rendering options
    ctx.mozImageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.msImageSmoothingEnabled = false;
	ctx.imageSmoothingEnabled = false;

	bg.addEventListener("load", function(ev) {
		bgLoaded = true;
	});

	img.addEventListener("load", function(ev) {

		var guiControllerRows,
			guiControllerCols;

		//setup event Listeners
		canvas.addEventListener('mousemove', function(ev) {

			mouseX = ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
			mouseY = ev.clientY + document.body.scrollTop + document.documentElement.scrollTop;

			mouseX -= canvas.offsetLeft;
			mouseY -= canvas.offsetTop;
		});

		//reset every piece when the mouse leaves the canvas
		canvas.addEventListener('mouseleave', function(ev) {
			mouseX = null;
			mouseY = null;
		});

		//initialize pieces
		createPieces("initialize");

		canvas.width = img.width;
		canvas.height = img.height;

		//setup DAT.GUI
		guiControllerRows = gui.add(options, "rows").min(1).max(100).step(1);
		guiControllerCols = gui.add(options, "cols").min(1).max(100).step(1);
		gui.add(options, "springStrength").min(0.0).max(0.5).step(0.01);
		gui.add(options, "rotationForce").min(0.0).max(0.2).step(0.01);
		gui.add(options, "dampen").min(0.1).max(1).step(0.01);

		guiControllerRows.onFinishChange(function(value) {
			options.rows = value;
			options.rcHasChanged = true;
			//createPieces("rows change");
		});

		guiControllerCols.onFinishChange(function(value) {
			options.cols = value;
			options.rcHasChanged = true;
			//createPieces("cols change");
		});


		//start animation
		requestAnimationFrame(update);
	});

	function createPieces(stat) {
		pieces.length = 0;

		sizeCols = canvas.width / options.cols;
		sizeRows = canvas.height / options.rows;

		for (var i = 0; i < options.cols; i++) {
			for (var j = 0; j < options.rows; j++) {
				
				//create a new piece to be used to draw
				pieces.push(new Piece( i*sizeCols, j*sizeRows, sizeCols, sizeRows, i * sizeCols, j* sizeRows));
			}
		}

		options.rcHasChanged = false;
		console.log(stat, pieces.length);
	};

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

		//check to see if rows or cols have changed
		rS('createPieces').start();
		if (options.rcHasChanged) {
			createPieces('update');
		}
		rS('createPieces').end();

		rS('updateTime').start();
		//update pieces
		for (var i = 0; i < pieces.length; i++) {
			var mdx,        //the difference between the point and the mouse x-coord
				mdy,        //the difference between the point and the mouse y-coord
				dd,         //distance squared between point and mouse
				d,			//the distance between the point and mouse
				dx,			//the distance between projectedX and currX of this particle
				dy,			//the distance between projectedY and currY of this particle
				impulseX,	//calculated force orthogonal to dx
				impulseY;	//calculated force orthogonal to dy

			//calculate new projected point
			mdx = (mouseX === null ) ? -550 : mouseX - pieces[i].x;
			mdy = (mouseY === null ) ? -550 : mouseY - pieces[i].y;
			dd  = (mdx * mdx) + (mdy * mdy);
			d   = Math.sqrt(dd);

			if (d <= 100) {
				pieces[i].projectedX = pieces[i].x - mdx;
				pieces[i].projectedY = pieces[i].y - mdy;
			}
			else {
				pieces[i].projectedX = pieces[i].originX;
				pieces[i].projectedY = pieces[i].originY;
			}

			//get the change in pos from where the piece is currently, and where it is projected to be
			dx = pieces[i].projectedX - pieces[i].x;
			dy = pieces[i].projectedY - pieces[i].y;

			//calculate spring impulses 
			impulseX = (dx * options.springStrength) - (dy * options.rotationForce);
			impulseY = (dy * options.springStrength) + (dx * options.rotationForce);

			//apply spring impulses
			pieces[i].dx += impulseX;
			pieces[i].dy += impulseY;

			//dampen velocity
			pieces[i].dx *= options.dampen;
			pieces[i].dy *= options.dampen;

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
	bg.src = "./images/sheep.jpg";
	img.src = "./images/turtle.jpg";
	//bg.src = "./turtle.jpg";
	//img.src = "./sheep.jpg";
});