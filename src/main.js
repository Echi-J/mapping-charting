
import './style.css'
import { BASEMAP } from '@deck.gl/carto';
import { Map, setWorkerUrl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { subscribe } from './mqttClient';
import * as d3 from 'd3';
import * as echarts from 'echarts';

// Configure the worker URL
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
setWorkerUrl(workerUrl);

// Import Deck.gl libraries
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ScatterplotLayer, GeoJsonLayer, IconLayer } from '@deck.gl/layers';

// Initialise MapLibre BaseMap

const colorScaleFunction = d3.scaleThreshold()
  .domain([0, 1, 2, 3, 4])
  .range([ //RGB format
    [255, 13, 13,220], //red
    [255, 78, 17,220],
    [255, 142, 21,220],
    [172, 179, 52,220],
    [105, 179, 76,220], //green
  ]);


const colorBikesFunction = d3.scaleThreshold()
  .domain([0.15, 0.35, 0.45, 0.55, 0.75]) //% of free bikes
  .range([ //RGB format
    [255, 13, 13], //red
    [255, 78, 17],
    [255, 142, 21],
    [250, 183, 51],
    [172, 179, 52],
    [105, 179, 76], //green
]);

const map = new Map({
  container: 'map',
  style: BASEMAP.POSITRON,
  interactive: true,
  center: [-0.014, 51.540],
  zoom: 16
});

// Wait until the map is fully loaded
await map.once('load');

// Declare a circle layer
let layerCircle = new ScatterplotLayer({
  id: 'deckgl-circle',
  data: [
    { position: [-0.12262486445294093, 51.50756471490389] },
  ],
  getPosition: d => d.position,
  getFillColor: [242, 133, 0, 90],
  getRadius: 1000,
});


 // Declare the bench/sensor layer
// let sensorBench = new GeoJsonLayer({
//   id: 'sensor-bench',
//   data: './benches_enriched.geojson',
//   filled: true,
//   pointRadiusScale: 1,
//   getPointRadius: 5,
//   getFillColor: [200, 0, 80, 190],
// });


// let sensorBench = new IconLayer({
//   id: 'sensor-bench-icons',
//   pickable: true,
//   data: './benches_enriched.geojson',

//   dataTransform: d => d.features.filter(f => f.geometry != null),

//   getPosition: f => f.geometry.coordinates,
//   getIcon: d => 'marker',
//   getSize: 20,

//   iconAtlas: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Map_pin_icon.svg',

//   iconMapping: {
//     marker: {
//       x: 0,
//       y: 0,
//       width: 94,
//       height: 128,
//       anchorY: 128,
//       mask: false
//     }
//   },

//  // Handle mouse hover
//   onHover: info => {
//     const { coordinate, object } = info;

//     if (!object) {
//       popup.remove();
//       map.getCanvas().style.cursor = 'grab';
//       return;
//     }

//     map.getCanvas().style.cursor = 'pointer';
//     console.log(object);

//     const data = object.properties || {};
//     let rows = '';

//     for (const [key, value] of Object.entries(object.properties)) {
//       if (value) {
//         rows += `<tr>
//           <td><b>${key}</b></td>
//           <td>${value}</td>
//         </tr>`;
//       }
//     }

//     const description = `<div>
//       <h4>Bench</h4>
//       <table>${rows}</table>
//     </div>`;

//     popup.setLngLat(coordinate)
//       .setHTML(description)
//       .addTo(map);
//   },
// });

const benchState = new globalThis.Map();
let benchStateVersion = 0;

function createBenchLayer() {
// Create and return a new IconLayer.
// Recreating the layer allows Deck.gl to refresh icon colours when sensor values change.
  
  return new IconLayer({
    id: 'sensor-bench-icons',
    pickable: true,
    data:'./benches_enriched.geojson',
    dataTransform: d => d.features.filter(f => f.geometry),// Keep only features that contain valid geometry data.
    getPosition: f => f.geometry.coordinates,
    getIcon: () => 'marker', //need to match the key in `iconMapping`
    getSize: 20,
      // Set the icon colour according to the latest occupancy value
      // received from the MQTT broker.
      //added Line for the colours
      getColor: (f) => colorScaleFunction(benchState.get(f.properties.sensor_name) ?? 0),
      //added Line for the colours
    iconAtlas: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Map_pin_icon.svg',
    iconMapping: { marker: { x: 0, y: 0, width: 94, height: 128, anchorY: 128, mask: true } }, //mask is set to true
      // Force Deck.gl to recalculate icon colours whenever
      // benchStateVersion changes.
      //added line to trigger the attribute colour
      updateTriggers: {getColor: benchStateVersion},
          onHover: info => {
            const { coordinate, object } = info;
            if (!object) {
                popup.remove();
                map.getCanvas().style.cursor = 'grab';
                return;
              }
            
            map.getCanvas().style.cursor = 'pointer';

            //Use object.properties if it exists; otherwise use an empty object {}.
            const data = object.properties || {};

            // Build table rows automatically
            // Create one table row for every property
            let rows = '';
            let occupancyData='';

            for (const [key, value] of Object.entries(object.properties)) {
                if (value) {
                    rows += `
                    <tr>
                    <td><b>${key}</b></td>
                    <td>${value}</td>
                    </tr>
                    `;
                }

                if(key==="sensor_name"){
                    occupancyData = benchState.get(value) ?? 0; //if the value is found get it, otherwise set 0
                }

                const description = `
                  <div>
                  <h4>Bench</h4>
                  <table>
                  ${rows}

                  <tr>
                  <td><b>Occupancy:</b></td>
                  <td>${occupancyData}</td>
                  </tr>

                  </table>
                  </div>
                  `;

                popup
                .setLngLat(coordinate)
                .setHTML(description)
                .addTo(map);
            }
          } //end of the onHover

}); //end of the IconLayer

}// end of the createBenchLayer

// Create initial layer
let sensorBench = createBenchLayer(); //trigger the function

// Overlay Deck.gl layers on MapLibre
const popup = new Popup({
  closeOnClick: false,
  closeOnMove: true
});


const londonBikes = new ScatterplotLayer({
  id: 'london-bikes',
  data: 'https://api.citybik.es/v2/networks/santander-cycles',
  //dataTransform: d => d.network.stations,
  dataTransform: d => d.network.stations.filter(s =>
        s.latitude >= 51.5307 && //min Lat
        s.latitude <= 51.5519 && //max Lat
        s.longitude >= -0.0264 && //min Long
        s.longitude <= -0.0071    //max Long
  ),
  pickable: true,
  opacity: 0.8,
  stroked: true,
  filled: true,
  radiusScale: 2,
  radiusMinPixels: 10,
  radiusMaxPixels: 150,
  lineWidthMinPixels: 1,
  getPosition: (d) => [d.longitude, d.latitude, 5],
  getRadius: (d) => d.free_bikes,
  getFillColor: (d) =>colorBikesFunction((d.free_bikes/(d.free_bikes+d.empty_slots))),
  getLineColor: (d) => [0, 0, 30],

  onHover: info => {
    const {coordinate, object} = info;
    if (!object) {
      popup.remove();
      map.getCanvas().style.cursor = 'grab';
      return;
    }
    map.getCanvas().style.cursor = 'pointer';
  },

  onClick: (info) => {
    console.log(info);
    const {coordinate, object} = info;
    const description = `
      <div class="bike-popup">
        <img src="https://upload.wikimedia.org/wikipedia/commons/d/d4/Cyclist_Icon_Germany_A1.svg" class='icon'/>
          <p class='title'> ${object.name}</p>
          <p class='item-a'> Free Bikes: ${object.free_bikes}</p>
          <p class='item-b'> Empty Docks: ${object.empty_slots}</p>
          <div id='item-c'></div>
          </div>`;

    // MapLibre Popup
    const popup = document.getElementsByClassName('maplibregl-popup');

    if (popup.length) {
      popup[0].remove();
    }

    new Popup({closeOnClick: false, closeOnMove: true})
      .setLngLat(coordinate)
      .setHTML(description)
      .addTo(map);
    chart(object);
  }
});

const deckOverlay = new MapLibreOverlay({
  interleaved: true,
  layers: [
    layerCircle,
    sensorBench,
    londonBikes
  ]
});

map.addControl(deckOverlay);
deckOverlay.setProps({getCursor: () => map.getCanvas().style.cursor});

// Subscribe to MQTT wildcard for all benches
const TOPIC_PREFIX = 'personal/ucfnvsi/dabo/benches';

subscribe(TOPIC_PREFIX, (Id, msg) => {
  const parsed=JSON.parse(msg);
  console.log('[Bench MQTT]', Id, parsed.occupied);

// Update sensors state and redraw
  benchState.set(Id, parsed.occupied);
  
  benchStateVersion++

// Replace only the bench layer with a newly created version and keep all
// other Deck.gl layers unchanged. Recreating the layer forces Deck.gl to
// recalculate the colours based on the latest sensor values.
const updatedLayers = deckOverlay._deck.props.layers.map(layer => layer.id === 'sensor-bench-icons' ? createBenchLayer() : layer);
deckOverlay.setProps({layers: updatedLayers});
});


const timer = setInterval(() => {
  //in case other layers are used, keep them and update just the bike one
  const updatedLayers= deckOverlay._deck.props.layers.map(layer => layer.id === 'london-bikes' ? londonBikes : layer);
  deckOverlay.setProps({ //update the layers
         layers:
         updatedLayers})
   console.log('Data Updated');
}, 1200000); //API called every 20 min => 1200000 ms


function chart(object) {
  var myChartEchart = echarts.init(document.getElementById("item-c"));

  var option = {
    xAxis: {
      type: "category",
      data: ['Free Bikes', 'Empty Docks'],
      axisLabel: {
        interval: 0,
        rotate: 30,
        fontSize: 10
      }
    },

    yAxis: {
      type: "value",
      min: 0,
      max: object.free_bikes + object.empty_slots > 0
        ? object.free_bikes + object.empty_slots
        : 1,
      nameLocation: "center",
      nameTextStyle: {
        align: "center"
      }
    },

    series: [
      {
        type: 'bar',
        barWidth: 25,
        data: [
          {
            value: object.free_bikes,
            itemStyle: {
              color: 'rgb(' + colorBikesFunction(
                object.free_bikes / (object.free_bikes + object.empty_slots)
              ) + ')'
            }
          },
          {
            value: object.empty_slots,
            itemStyle: {
              color: 'rgb(' + colorBikesFunction(
                object.empty_slots / (object.free_bikes + object.empty_slots)
              ) + ')'
            }
          }
        ]
      }
    ]
  };

  myChartEchart.setOption(option);
}
