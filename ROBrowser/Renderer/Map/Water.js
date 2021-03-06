/**
 * Renderer/Map/Water.js
 *
 * Rendering water
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define( ['Utils/WebGL'], function( WebGL )
{
	"use strict";


	/**
	 * Private variables
	 */
	var _program      = null;
	var _buffer       = null;

	var _vertCount    = 0;
	var _textures     = new Array(32);

	var _waveSpeed    = 0;
	var _waveHeight   = 0;
	var _wavePitch    = 0;
	var _waterLevel   = 0;
	var _animSpeed    = 0;
	var _waterOpacity = 0.6;


	/**
	 * @var {string} vertex shader
	 */
	var _vertexShader   = '\
		attribute vec3 aPosition;\
		attribute vec2 aTextureCoord;\
		\
		varying vec2 vTextureCoord;\
		\
		uniform mat4 uModelViewMat;\
		uniform mat4 uProjectionMat;\
		\
		uniform float uTick;\
		uniform float uWaveHeight;\
		\
		const float PI = 3.14159265358979323846264;\
		\
		void main(void) {\
			float HeightX = sin( PI * (aPosition.x * 0.1 + uTick) );\
			float HeightY = cos( PI * (aPosition.y * 0.1 + uTick) );\
			float Height  = HeightX * HeightY * uWaveHeight;\
			\
			gl_Position = uProjectionMat * uModelViewMat * vec4( aPosition.x, aPosition.y + Height, aPosition.z, 1.0) ;\
			\
			vTextureCoord   = aTextureCoord;\
		}';


	/**
	 * @var {string} fragment shader
	 */
	var _fragmentShader = '\
		varying vec2 vTextureCoord;\
		\
		uniform sampler2D uDiffuse;\
		\
		uniform bool  uFogUse;\
		uniform float uFogNear;\
		uniform float uFogFar;\
		uniform vec3  uFogColor;\
		\
		uniform vec3  uLightAmbient;\
		uniform vec3  uLightDiffuse;\
		uniform float uLightOpacity;\
		\
		uniform float uOpacity;\
		\
		void main(void) {\
			vec4 Texture    = vec4( texture2D( uDiffuse, vTextureCoord).rgb, uOpacity);\
			vec4 LightColor = vec4( uLightAmbient * uLightOpacity + uLightDiffuse, 1.0);\
			\
			gl_FragColor    = Texture * clamp(LightColor, 0.0, 1.0);\
			if ( uFogUse ) {\
				float depth     = gl_FragCoord.z / gl_FragCoord.w;\
				float fogFactor = smoothstep( uFogNear, uFogFar, depth );\
				gl_FragColor    = mix( gl_FragColor, vec4( uFogColor, gl_FragColor.w ), fogFactor );\
			}\
		}';


	/**
	 * Initialize water data
	 *
	 * @param {object} gl context
	 * @param {object} water data
	 */
	function Init( gl, water )
	{
		var i;

		// Water informations
		_vertCount    = water.vertCount;
		_waveHeight   = water.waveHeight;
		_waveSpeed    = water.waveSpeed;
		_waterLevel   = water.level;
		_animSpeed    = water.animSpeed;
		_wavePitch    = water.wavePitch;
		_waterOpacity = water.type !== 4 && water.type !== 6 ? 0.6 : 1.0;

		// No water ?
		if( !_vertCount ) {
			return;
		}

		// Link program	if not loaded
		if( ! _program ) {
			_program = WebGL.createShaderProgram( gl, _vertexShader, _fragmentShader );
		}

		// Bind mesh
		_buffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );
		gl.bufferData( gl.ARRAY_BUFFER, water.mesh, gl.STATIC_DRAW );

		// Bind water textures
		for ( i=0; i<32; ++i ) {
			WebGL.texture( gl, water.images[i], function( texture, i ){
				_textures[i] = texture;
			}, i );
		}
	}


	/**
	 * Render water
	 *
	 * @param {object} gl context
	 * @param {mat4} modelView
	 * @param {mat4} projection
	 * @param {object} fog structure
	 * @param {object} light structure
	 * @param {number} tick (game tick)
	 */
	function Render( gl, modelView, projection, fog, light, tick )
	{
		// If no water, don't need to process.
		if( !_vertCount ) {
			return; 
		}

		var uniform   = _program.uniform;
		var attribute = _program.attribute;

		gl.useProgram( _program );

		// Bind matrix
		gl.uniformMatrix4fv( uniform.uModelViewMat,  false,  modelView );
		gl.uniformMatrix4fv( uniform.uProjectionMat, false,  projection );

		// Bind light
		gl.uniform1f(  uniform.uLightOpacity,   light.opacity );
		gl.uniform3fv( uniform.uLightAmbient,   light.ambient );
		gl.uniform3fv( uniform.uLightDiffuse,   light.diffuse );

		// Fog settings
		gl.uniform1i(  uniform.uFogUse,   fog.use && fog.exist );
		gl.uniform1f(  uniform.uFogNear,  fog.near );
		gl.uniform1f(  uniform.uFogFar,   fog.far  );
		gl.uniform3fv( uniform.uFogColor, fog.color );

		// Enable all attributes
		gl.enableVertexAttribArray( attribute.aPosition );
		gl.enableVertexAttribArray( attribute.aTextureCoord );

		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );

		// Link attribute
		gl.vertexAttribPointer( attribute.aPosition,     3, gl.FLOAT, false, 5*4, 0 );
		gl.vertexAttribPointer( attribute.aTextureCoord, 2, gl.FLOAT, false, 5*4, 3*4 );

		// Textures
		gl.activeTexture( gl.TEXTURE0 );
		gl.uniform1i( uniform.uDiffuse, 0 );

		// TODO: find how water animation/speed works

		// Water infos
		gl.uniform1f( uniform.uTick,        tick % 1000 / 1000 );
		gl.uniform1f( uniform.uWaveHeight,  _waveHeight );
		gl.uniform1f( uniform.uOpacity,     _waterOpacity );

		// Send mesh
		gl.bindTexture( gl.TEXTURE_2D, _textures[ tick / (1000/32*_animSpeed) % 32 | 0 ] );
		gl.drawArrays(  gl.TRIANGLES,  0, _vertCount );
	
		// Is it needed ?
		gl.disableVertexAttribArray( attribute.aPosition );
		gl.disableVertexAttribArray( attribute.aTextureCoord );
	}


	/**
	 * Clean texture/buffer from memory
	 *
	 * @param {object} gl context
	 */
	function Free( gl )
	{
		var i;

		if( _buffer ) {
			gl.deleteBuffer( _buffer );
			_buffer = null;
		}

		if( _program ) {
			gl.deleteProgram( _program );
			_program = null;
		}

		for ( i=0; i<32; ++i ) {
			if ( _textures[i] ) {
				gl.deleteTexture(_textures[i]);
				_textures[i] = null;
			}
		}
	}


	/**
	 * Export
	 */
	return {
		init:   Init,
		free:   Free,
		render: Render
	};
});