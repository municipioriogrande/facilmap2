(function(fm, $, ng, undefined) {

	fm.app.factory("fmMapLines", function(fmUtils, $uibModal, $templateCache, $compile, $timeout) {
		return function(map) {
			var linesById = { };
			var editingLineId = null;

			map.socket.on("line", function(data) {
				setTimeout(function() { // trackPoints needs to be copied over
					if(map.socket.filterFunc(map.socket.lines[data.id]))
						linesUi._addLine(map.socket.lines[data.id]);
				}, 0);
			});

			map.socket.on("deleteLine", function(data) {
				linesUi._deleteLine(data);
			});

			map.socket.on("linePoints", function(data) {
				setTimeout(function() {
					if(map.socket.filterFunc(map.socket.lines[data.id]))
						linesUi._addLine(map.socket.lines[data.id]);
				}, 0);
			});

			map.socket.on("filter", function() {
				for(var i in map.socket.lines) {
					var show = map.socket.filterFunc(map.socket.lines[i]);
					if(linesById[i] && !show)
						linesUi._deleteLine(map.socket.lines[i]);
					else if(!linesById[i] && show)
						linesUi._addLine(map.socket.lines[i]);
				}
			});

			var linesUi = {
				_addLine: function(line) {
					var trackPoints = [ ];
					var p = (editingLineId != null && editingLineId == line.id ? line.routePoints : line.trackPoints) || [ ];
					for(var i=0; i<p.length; i++) {
						if(p[i] != null)
							trackPoints.push(L.latLng(p[i].lat, p[i].lon));
					}

					if(trackPoints.length < 2)
						return linesUi._deleteLine(line);

					if(!linesById[line.id]) {
						linesById[line.id] = L.polyline([ ]).addTo(map.map);
						map.map.almostOver.addLayer(linesById[line.id]);

						if(line.id != null && line.id != editingLineId) { // We don't want a popup for lines that we are drawing right now
							linesById[line.id]
								.bindPopup($("<div/>")[0], map.popupOptions)
								.on("popupopen", function(e) {
									linesUi._renderLinePopup(map.socket.lines[line.id]);
								})
								.on("popupclose", function(e) {
									ng.element(e.popup.getContent()).scope().$destroy();
								})
								.on("fm-almostover", function(e) {
									if(!linesById[line.id].getTooltip())
										linesById[line.id].bindTooltip("", $.extend({}, map.tooltipOptions, { permanent: true, offset: [ 20, 0 ] }));

									linesById[line.id].setTooltipContent(fmUtils.quoteHtml(map.socket.lines[line.id].name)).openTooltip(e.latlng);
								})
								.on("fm-almostmove", function(e) {
									linesById[line.id].openTooltip(e.latlng)
								})
								.on("fm-almostout", function() {
									linesById[line.id].closeTooltip();
								});
						}
					}

					var style = {
						color : '#'+line.colour,
						weight : line.width,
						opacity : 0.7
					};

					var same = ng.equals(linesById[line.id].getLatLngs(), trackPoints);

					linesById[line.id].setLatLngs(trackPoints).setStyle(style);

					if(line.id != null && line.id != editingLineId && linesById[line.id].isPopupOpen()) {
						if(same)
							linesUi._renderLinePopup(line);
						else
							linesById[line.id].openPopup();
					}
				},
				_deleteLine: function(line) {
					var lineObj = linesById[line.id];
					if(!lineObj)
						return;

					map.map.almostOver.removeLayer(lineObj);
					lineObj.removeFrom(map.map);
					delete linesById[line.id];
				},
				_renderLinePopup: function(line) {
					var scope = map.socket.$new();

					scope.line = line;

					scope.edit = function() {
						linesUi.editLine(scope.line);
					};

					scope.move = function() {
						linesUi.moveLine(scope.line);
					};

					scope['delete'] = function() {
						linesUi.deleteLine(scope.line);
					};

					var popup = linesById[line.id].getPopup();
					var el = popup.getContent();
					$(el).html($templateCache.get("map/lines/view-line.html"));
					$compile(el)(scope);

					// Prevent popup close on button click
					$("button", el).click(function(e) {
						e.preventDefault();
					});

					$timeout(function() { $timeout(function() { // $compile only replaces variables on next digest

						// Prevent the map to scroll to the popup every time we move it and some more detail of the line gets loaded
						var autoPanBkp = popup.options.autoPan;
						popup.options.autoPan = false;
						popup.update();
						popup.options.autoPan = autoPanBkp;
					}); });
				},
				_makeLineMovable: function(line) {
					var markers = [ ];

					editingLineId = line.id;

					// Re-add the line without a popup (because editingLineId is set)
					linesUi._deleteLine(line);
					linesUi._addLine(line);

					// Watch if route points change (because someone else has moved the line while we are moving it
					var routePointsBkp = ng.copy(line.routePoints);
					var unregisterWatcher = map.socket.$watch(function() { return map.socket.lines[line.id].routePoints; }, function() {
						// We do not do a deep watch, as then we will be not notified if someone edits the line without
						// actually moving it, in which case we still need to redraw it (because it gets redrawn because
						// the server sends it to us again).

						// The line has been edited, but it has not been moved. Override its points with our current stage again
						if(ng.equals(routePointsBkp, map.socket.lines[line.id].routePoints))
							map.socket.lines[line.id].routePoints = line.routePoints;
						else // The line has been moved. Override our stage with the new points.
							routePointsBkp = ng.copy(line.routePoints);

						line = map.socket.lines[line.id];
						linesUi._addLine(line);
						removeTempMarkers();
						createTempMarkers();
					});

					function createTempMarker(huge) {
						var marker = L.marker([0,0], {
							icon: fmUtils.createMarkerIcon(map.dragMarkerColour, 35, null, huge ? 1000 : null),
							draggable: true
						})
							.on("dblclick", function() {
								// Double click on temporary marker: Remove this route point
								var idx = markers.indexOf(marker);
								markers.splice(idx, 1);
								line.routePoints.splice(idx, 1);
								marker.remove();
								linesUi._addLine(line);
							})
							.on("drag", function() {
								var idx = markers.indexOf(marker);
								var latlng = marker.getLatLng();
								line.routePoints[idx] = { lat: latlng.lat, lon: latlng.lng };
								linesUi._addLine(line);
							});
						return marker;
					}

					function createTempMarkers() {
						line.routePoints.forEach(function(it) {
							markers.push(createTempMarker().setLatLng([ it.lat, it.lon ]).addTo(map.map));
						});
					}

					function removeTempMarkers() {
						for(var i=0; i<markers.length; i++)
							markers[i].remove();
						markers = [ ];
					}

					// This marker is shown when we hover the line. It enables us to create new markers.
					// It is a huge one (a normal marker with 5000 px or so transparency around it, so that we can be
					// sure that the mouse is over it and dragging it will work smoothly.
					var temporaryHoverMarker;

					function _over(e) {
						temporaryHoverMarker.setLatLng(e.latlng).addTo(map.map);
					}

					function _move(e) {
						temporaryHoverMarker.setLatLng(e.latlng);
					}

					function _out(e) {
						temporaryHoverMarker.remove();
					}

					linesById[line.id].on("fm-almostover", _over).on("fm-almostmove", _move).on("fm-almostout", _out);

					function makeTemporaryHoverMarker() {
						temporaryHoverMarker = createTempMarker(true);

						temporaryHoverMarker.once("dragstart", function() {
							temporaryHoverMarker.once("dragend", function() {
								// We have to replace the huge icon with the regular one at the end of the dragging, otherwise
								// the dragging gets interrupted
								this.setIcon(fmUtils.createMarkerIcon("ffd700", 35));
							}, temporaryHoverMarker);

							var latlng = temporaryHoverMarker.getLatLng();
							var idx = fmUtils.getIndexOnLine(map.map, line.routePoints, line.routePoints, latlng);
							markers.splice(idx, 0, temporaryHoverMarker);
							line.routePoints.splice(idx, 0, { lat: latlng.lat, lon: latlng.lng });

							makeTemporaryHoverMarker();
						});
					}

					makeTemporaryHoverMarker();

					return {
						done : function() {
							editingLineId = null;
							unregisterWatcher();
							removeTempMarkers();
							temporaryHoverMarker.remove();

							// Re-add the line witho a popup (because editingLineId is not set anymore)
							linesUi._deleteLine(line);
							linesUi._addLine(line);

							return line.routePoints;
						}
					};
				},
				editLine: function(line) {
					var scope = map.socket.$new();

					var dialog = $uibModal.open({
						templateUrl: "map/lines/edit-line.html",
						scope: scope,
						controller: "fmMapLineEditCtrl",
						size: "lg",
						resolve: {
							map: function() { return map; }
						}
					});

					var preserve = fmUtils.preserveObject(scope, "lines["+fmUtils.quoteJavaScript(line.id)+"]", "line", function() {
						dialog.dismiss();
					});

					dialog.result.then(preserve.leave.bind(preserve), preserve.revert.bind(preserve));
				},
				addLine: function(type) {
					map.map.closePopup();

					map.socket.emit("getLineTemplate", { typeId: type.id }).then(function(line) {

						line.routePoints = [ ];
						line.trackPoints = [ ];
						var message = map.messages.showMessage("info", "Please click on the map to draw a line. Double-click to finish it.", [
							{ label: "Finish", click: finishLine.bind(null, true) },
							{ label: "Cancel", click: finishLine.bind(null, false) }
						], null, finishLine.bind(null, false, true));

						var handler = null;

						function addPoint(pos) {
							line.routePoints.push(pos);
							line.trackPoints = [ ].concat(line.routePoints, [ pos ]); // Add pos a second time so that it gets overwritten by mouseMoveListener
							linesUi._addLine(line);
							handler = map.addClickListener(mapClick, mouseMove);
						}

						function finishLine(save, noClose) {
							if(!noClose)
								message.close();

							handler && handler.cancel();
							linesUi._deleteLine(line);

							if(save && line.routePoints.length >= 2)
								linesUi.createLine(type, line.routePoints);
						}

						var mapClick = function(pos) {
							if(line.routePoints.length > 0 && pos.lon == line.routePoints[line.routePoints.length-1].lon && pos.lat == line.routePoints[line.routePoints.length-1].lat)
								finishLine(true);
							else
								addPoint(pos);
						};

						var mouseMove = function(pos) {
							if(line.trackPoints.length > 0) {
								line.trackPoints[line.trackPoints.length-1] = pos;
								linesUi._addLine(line);
							}
						};

						handler = map.addClickListener(mapClick, mouseMove);
					}).catch(function(err) {
						map.messages.showMessage("danger", err);
					});
				},
				createLine: function(type, routePoints, properties) {
					map.socket.emit("addLine", $.extend({ routePoints: routePoints, typeId: type.id }, properties)).then(function(line) {
						linesUi.editLine(line);

						// We have to wait until the server sends us the trackPoints of the line
						var removeWatcher = map.socket.$watch(function() { return !!linesById[line.id]; }, function(exists) {
							if(exists) {
								linesById[line.id].openPopup();
								removeWatcher();
							}
						});
					}).catch(function(err) {
						map.messages.showMessage("danger", err);
					});
				},
				moveLine: function(line) {
					var movable = linesUi._makeLineMovable(line);

					var message = map.messages.showMessage("info", "Drag the line points around to change it. Double-click a point to remove it.", [
						{ label: "Finish", click: done.bind(null, true) },
						{ label: "Cancel", click: done.bind(null, false) }
					], null, done.bind(null, false, true));

					map.map.closePopup();

					function done(save, noClose) {
						var newPoints = movable.done();
						linesUi._addLine(line);
						linesById[line.id].openPopup();

						if(!noClose) {
							message.close();
						}

						if(save) {
							line.trackPoints = { };
							map.socket.emit("editLine", { id: line.id, routePoints: newPoints }).catch(function(err) {
								map.messages.showMessage("danger", err);
							});
						}
					}
				},
				deleteLine: function(line) {
					map.socket.emit("deleteLine", line).catch(function(err) {
						map.messages.showMessage("danger", err);
					});
				}
			};

			return linesUi;
		};
	});

	fm.app.controller("fmMapLineEditCtrl", function($scope, map) {
		$scope.canControl = function(what) {
			return map.typesUi.canControl($scope.types[$scope.line.typeId], what);
		};

		$scope.save = function() {
			$scope.error = null;

			var lineObj = ng.copy($scope.line);
			delete lineObj.trackPoints;

			map.socket.emit("editLine", lineObj).then(function() {
				$scope.$close();
			}).catch(function(err) {
				return $scope.error = err;
			});
		};

		$scope.$watchGroup([ "line.colour", "line.width" ], function() {
			map.linesUi._addLine($scope.line);
		});
	});

})(FacilMap, jQuery, angular);