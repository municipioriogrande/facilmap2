(function(fp, $, ng, undefined) {

	fp.app.factory("fpNameFinder", function($q) {
		var shortLinkCharArray = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@";

		var fpNameFinder = {
			url : "https://nominatim.openstreetmap.org/search",
			limit : 25,
			stateAbbr : {
				"us" : {
					"alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT",
					"delaware":"DE","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA",
					"kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI",
					"minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH",
					"new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
					"oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN",
					"texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY"
				},
				"it" : {
					"agrigento":"AG","alessandria":"AL","ancona":"AN","aosta":"AO","arezzo":"AR","ascoli piceno":"AP","asti":"AT",
					"avellino":"AV","bari":"BA","barletta":"BT","barletta-andria-trani":"BT","belluno":"BL","benevento":"BN",
					"bergamo":"BG","biella":"BI","bologna":"BO","bolzano":"BZ","brescia":"BS","brindisi":"BR","cagliari":"CA",
					"caltanissetta":"CL","campobasso":"CB","carbonia-iglesias":"CI","caserta":"CE","catania":"CT","catanzaro":"CZ",
					"chieti":"CH","como":"CO","cosenza":"CS","cremona":"CR","crotone":"KR","cuneo":"CN","enna":"EN","fermo":"FM",
					"ferrara":"FE","firenze":"FI","foggia":"FG","forli-cesena":"FC","frosinone":"FR","genova":"GE","gorizia":"GO",
					"grosseto":"GR","imperia":"IM","isernia":"IS","la spezia":"SP","l'aquila":"AQ","latina":"LT","lecce":"LE",
					"lecco":"LC","livorno":"LI","lodi":"LO","lucca":"LU","macerata":"MC","mantova":"MN","massa e carrara":"MS",
					"matera":"MT","medio campidano":"VS","messina":"ME","milano":"MI","modena":"MO","monza e brianza":"MB",
					"napoli":"NA","novara":"NO","nuoro":"NU","ogliastra":"OG","olbia-tempio":"OT","oristano":"OR","padova":"PD",
					"palermo":"PA","parma":"PR","pavia":"PV","perugia":"PG","pesaro e urbino":"PU","pescara":"PE","piacenza":"PC",
					"pisa":"PI","pistoia":"PT","pordenone":"PN","potenza":"PZ","prato":"PO","ragusa":"RG","ravenna":"RA",
					"reggio calabria":"RC","reggio emilia":"RE","rieti":"RI","rimini":"RN","roma":"RM","rovigo":"RO","salerno":"SA",
					"sassari":"SS","savona":"SV","siena":"SI","siracusa":"SR","sondrio":"SO","taranto":"TA","teramo":"TE","terni":"TR",
					"torino":"TO","trapani":"TP","trento":"TN","treviso":"TV","trieste":"TS","udine":"UD","varese":"VA","venezia":"VE",
					"verbano":"VB","verbano-cusio-ossola":"VB","vercelli":"VC","verona":"VR","vibo valentia":"VV","vicenza":"VI","viterbo":"VT"
				},
				"ca" : {
					"ontario":"ON","quebec":"QC","nova scotia":"NS","new brunswick":"NB","manitoba":"MB","british columbia":"BC",
					"prince edward island":"PE","saskatchewan":"SK","alberta":"AB","newfoundland and labrador":"NL"
				},
				"au" : {
					"australian capital territory":"ACT","jervis bay territory":"JBT","new south wales":"NSW","northern territory":"NT",
					"queensland":"QLD","south australia":"SA","tasmania":"TAS","victoria":"VIC","western australia":"WA"
				}
			},

			find : function(query) {
				query.replace(/^\s+/, "").replace(/\s+$/, "");

				var lonlat = fpNameFinder.isLonLatQuery(query);
				if(lonlat)
				{
					var results = [ {
						lat: lonlat.lat,
						lon : lonlat.lon,
						type : "coordinates",
						display_name : lonlat.lat + ", " + lonlat.lon,
						zoom: lonlat.zoom
					} ];
					return $q.when(results);
				}

				return $q.when($.get(fpNameFinder.url, {
					q: query,
					format: "jsonv2",
					polygon_geojson: 1,
					addressdetails: 1,
					limit: fpNameFinder.limit,
					extratags: 1
				}))
					.then(function(results) {
						results.forEach(function(result) {
							result.display_name = fpNameFinder.makeDisplayName(result);
						});

						return results;
					});
			},

			/**
			 * Tries to format a search result in a readable way according to the address notation habits in
			 * the appropriate country.
			 * @param result {Object} A place object as returned by Nominatim
			 * @return {String} A readable name for the search result
			 */
			makeDisplayName : function(result) {
				// See http://en.wikipedia.org/wiki/Address_%28geography%29#Mailing_address_format_by_country for
				// address notation guidelines

				var type = result.type;
				var name = result.address[result.type] || result.display_name.split(',')[0] || "";
				var countryCode = result.address.country_code;

				var road = result.address.road;
				var housenumber = result.address.house_number;
				var suburb = result.address.town || result.address.suburb || result.address.village || result.address.hamlet || result.address.residential;
				var postcode = result.address.postcode;
				var city = result.address.city;
				var county = result.address.county;
				var state = result.address.state;
				var country = result.address.country;

				if([ "road", "residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state" ].indexOf(type) != -1)
					name = "";

				if(!city && suburb)
				{
					city = suburb;
					suburb = "";
				}

				if(road)
				{
					switch(countryCode)
					{
						case "pl":
							road = "ul. "+road;
							break;
						case "ro":
							road = "str. "+road;
							break;
					}
				}

				// Add house number to road
				if(road && housenumber)
				{
					switch(countryCode)
					{
						case "ar":
						case "at":
						case "ca":
						case "de":
						case "hr":
						case "cz":
						case "dk":
						case "fi":
						case "is":
						case "il":
						case "it":
						case "nl":
						case "no":
						case "pe":
						case "pl":
						case "sk":
						case "si":
						case "se":
						case "tr":
							road += " "+housenumber;
							break;
						case "be":
						case "es":
							road += ", "+housenumber;
							break;
						case "cl":
							road += " N° "+housenumber;
							break;
						case "hu":
							road += " "+housenumber+".";
							break;
						case "id":
							road += " No. "+housenumber;
							break;
						case "my":
							road = "No." +housenumber+", "+road;
							break;
						case "ro":
							road += ", nr. "+road;
							break;
						case "au":
						case "fr":
						case "hk":
						case "ie":
						case "in":
						case "nz":
						case "sg":
						case "lk":
						case "tw":
						case "gb":
						case "us":
						default:
							road += housenumber+" "+road;
							break;
					}
				}

				// Add postcode and districts to city
				switch(countryCode)
				{
					case "ar":
						if(postcode && city)
							city = postcode+", "+city;
						else if(postcode)
							city = postcode;
						break;
					case "at":
					case "ch":
					case "de":
						if(city)
						{
							if(suburb)
								city += "-"+(suburb);
							suburb = null;
							if(type == "suburb" || type == "residential")
								type = "city";

							if(postcode)
								city = postcode+" "+city;
						}
						break;
					case "be":
					case "hr":
					case "cz":
					case "dk":
					case "fi":
					case "fr":
					case "hu":
					case "is":
					case "il":
					case "my":
					case "nl":
					case "no":
					case "sk":
					case "si":
					case "es":
					case "se":
					case "tr":
						if(city && postcode)
							city = postcode+" "+city;
						break;
					case "au":
					case "ca":
					case "us":
						if(city && state)
						{
							var stateAbbr = fpNameFinder.stateAbbr[countryCode][state.toLowerCase()];
							if(stateAbbr)
							{
								city += " "+stateAbbr;
								state = null;
							}
						}
						if(city && postcode)
							city += " "+postcode;
						else if(postcode)
							city = postcode;
						break;
					case "it":
						if(city)
						{
							if(county)
							{
								var countyAbbr = fpNameFinder.stateAbbr.it[county.toLowerCase().replace(/ì/g, "i")];
								if(countyAbbr)
								{
									city += " ("+countyAbbr+")";
									county = null;
								}
							}
							if(postcode)
								city  = postcode+" "+city;
						}
						break;
					case "ro":
						if(city && county)
						{
							city += ", jud. "+county;
							county = null;
						}
						if(city && postcode)
							city += ", "+postcode;
						break;
					case "cl":
					case "hk":
						// Postcode rarely/not used
					case "ie":
					case "in":
					case "id":
					case "nz":
					case "pe":
					case "sg":
					case "lk":
					case "tw":
					case "gb":
					default:
						if(city && postcode)
							city = city+" "+postcode;
						else if(postcode)
							city = postcode;
						break;
				}

				var result = [ ];

				if(name)
					result.push(name);
				if(road)
					result.push(road);
				if(suburb)
					result.push(suburb);
				if(city)
					result.push(city);
				if([ "residential", "town", "suburb", "village", "hamlet", "residential", "city", "county", "state" ].indexOf(type) != -1)
				{ // Searching for a town
					if(county && county != city)
						result.push(county);
					if(state && state != city)
						result.push(state);
				}

				if(country)
					result.push(country);

				return result.join(", ");
			},

			/**
			 * Checks whether the given query string is a representation of coordinates, such as
			 * 48.123,5.123 or an OSM permalink.
			 * @param query {String}
			 * @return {Object} An object with the properties “lonlat” and “zoom” or null
			 */
			isLonLatQuery : function(query) {
				var query = query.replace(/^\s+/, "").replace(/\s+$/, "");
				var query_match,query_match2;
				if(query_match = query.match(/^http:\/\/(www\.)?osm\.org\/go\/([-A-Za-z0-9_@]+)/))
				{ // Coordinates, shortlink
					return fpNameFinder.decodeShortLink(query_match[2]);
				}

				if(query_match = query.match(/^(geo\s*:\s*)?(-?\s*\d+([.,]\d+)?)\s*[,;]?\s*(-?\s*\d+([.,]\d+)?)(\s*\?z\s*=\s*(\d+))?$/))
				{ // Coordinates
					return {
						lat: 1*query_match[2].replace(",", ".").replace(/\s+/, ""),
						lon : 1*query_match[4].replace(",", ".").replace(/\s+/, ""),
						zoom : query_match[7] != null ? 1*query_match[7] : 15
					};
				}

				function decodeQueryString(str) {
					var lonMatch,latMatch,leafletMatch;

					if((lonMatch = str.match(/[?&]lat=([^&]+)/)) && (latMatch = str.match(/[?&]lat=([^&]+)/))) {
						return {
							lat: 1*decodeURIComponent(latMatch[1]),
							lon: 1*decodeURIComponent(lonMatch[1]),
							zoom: 15
						};
					}

					if(leafletMatch = str.match(/(^|=)(\d+)\/(-?\d+(\.\d+)?)\/(-?\d+(\.\d+)?)(&|\/|$)/)) {
						return {
							lat: leafletMatch[3],
							lon: leafletMatch[5],
							zoom: leafletMatch[2]
						};
					}
				}

				if((query_match = query.match(/^https?:\/\/.*#(.*)$/)) && (query_match2 = decodeQueryString(query_match[1]))) {
					return query_match2;
				}

				if((query_match = query.match(/^https?:\/\/.*\?([^#]*)/)) && (query_match2 = decodeQueryString(query_match[1]))) {
					return query_match2;
				}

				return null;
			},

			/**
			 * Decodes a string from FacilMap.Util.encodeShortLink().
			 * @param encoded {String}
			 * @return {Object} (lonlat: OpenLayers.LonLat, zoom: Number)
			*/
			decodeShortLink: function(encoded) {
				var lon,lat,zoom;

				var m = encoded.match(/^([A-Za-z0-9_@]+)/);
				if(!m) return false;
				zoom = m[1].length*2+encoded.length-11;

				var c1 = 0;
				var c2 = 0;
				for(var i=0,j=54; i<m[1].length; i++,j-=6)
				{
					var bits = shortLinkCharArray.indexOf(m[1].charAt(i));
					if(j <= 30)
						c1 |= bits >>> (30-j);
					else if(j > 30)
						c1 |= bits << (j-30);
					if(j < 30)
						c2 |= (bits & (0x3fffffff >>> j)) << j;
				}

				var x = 0;
				var y = 0;

				for(var j=29; j>0;)
				{
					x = (x << 1) | ((c1 >> j--) & 1);
					y = (y << 1) | ((c1 >> j--) & 1);
				}
				for(var j=29; j>0;)
				{
					x = (x << 1) | ((c2 >> j--) & 1);
					y = (y << 1) | ((c2 >> j--) & 1);
				}

				x *= 4; // We can’t do <<= 2 here as x and y may be greater than 2³¹ and then the value would become negative
				y *= 4;

				lon = x*90.0/(1<<30)-180.0;
				lat = y*45.0/(1<<30)-90.0;

				return {
					lat : Math.round(lat*100000)/100000,
					lon: Math.round(lon*100000)/100000,
					zoom : zoom
				};
			},
		};

		return fpNameFinder;
	});

})(FacilPad, jQuery, angular);