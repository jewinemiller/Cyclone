import React from 'react';
import './App.css';
import axios from 'axios';

import { Map, Marker, Popup, TileLayer, GeoJSON } from 'react-leaflet'
import L, { LatLng } from 'leaflet';

export default class App extends React.Component {

  componentDidMount() {
    this.populateStormData();
  }


  populateStormData(){
    const outlookRegions = ['atl', 'pac', 'cpac'];
    outlookRegions.map((region) => {
        axios.get('http://localhost:8080/outlooks/' + region).then(res => {
        this.setState(prevState => ({
          outlooks: [...prevState.outlooks, res.data]
        }));
      });
    })

    axios.get(`http://localhost:8080/storms`)
      .then(res => {
        this.setState({storms: []});
        res.data.forEach(element => {
          axios.get(`http://localhost:8080/storms/` + element.id)
            .then(stormData => {
              var storm = stormData.data
              var promises = [];
              storm.products.forEach(element => {
                promises.push(axios.get('http://localhost:8080' + element.dir));
              });

              Promise.all(promises).then((values) => {
                values.forEach((product, index) => {
                  storm.products[index].data = product.data;
                });
                this.setState(prevState => ({
                  storms: [...prevState.storms, storm]
                }));
              });
            });
        });
      });
  }


  state = {
    lat: 39.8283,
    lng: -98.5795,
    zoom: 3,
    storms: [],
    outlooks: []
  }

  pointToLayer(feature, latlng) {

    var stormIntensity = this.getStormIntensity(this.getWindSpeed(feature.properties.description));

    var geojsonMarkerOptions = {
      radius: 8,
      fillColor: stormIntensity.color,
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    

    return L.circleMarker(latlng, geojsonMarkerOptions).bindPopup(feature.properties.description);
  }

  getWindSpeed(description){
    var windSpeedString; 
    windSpeedString = description.match(/\d+ knots/);
    var strippedSpeed = windSpeedString.toString().replace(/[^0-9]/g,'')
    return parseInt(strippedSpeed);
  }

  generateStormIcon(storm){
    var strippedSpeed = storm.maxSustainedWind.replace(/[^0-9]/g,'')
    var windspeed = this.mphToKts(parseInt(strippedSpeed));
    var intensity = this.getStormIntensity(windspeed);

    var stormIcon = new L.Icon({
      iconUrl: intensity.icon,
      iconSize: new L.Point(40, 40)
    });

    return stormIcon;
  }

  mphToKts(mph){
    var kts =  mph * 0.868976;
    return kts; 
  }

  getStormIntensity(windSpeed){
    const intensityMap = {
      33: {
        category: "Tropical Depression",
        color: "#1285c3",
        icon: "icons/td.png"
      }, 
      34: {
        category: "Tropical Storm",
        color: "#0eaf26",
        icon: "icons/ts.png"
      }, 
      64: {
        category: "Category 1 Hurricane",
        color: "#eae732",
        icon: "icons/cat1.png"
      }, 
      83: {
        category: "Category 2 Hurricane",
        color: "#e7ba31",
        icon: "icons/cat2.png"
      },
      96: {
        category: "Category 3 Hurricane",
        color: "#f2a52b",
        icon: "icons/cat3.png"
      },
      113: {
        category: "Category 4 Hurricane", 
        color: "#eb4c0d",
        icon: "icons/cat4.png"
      }, 
      137: {
        category: "Category 5 Hurricane",
        color: "#db0606",
        icon: "icons/cat5.png"
      }
    }

    const intensityValues = [33, 34, 64, 83, 96, 113, 137]; 

    for(var i = 0; i < intensityValues.length; i++){
      if(windSpeed < intensityValues[i]){
        return intensityMap[intensityValues[Math.max(0, i - 1)]];
      } else if(windSpeed >= intensityValues[i] && i == intensityValues.length - 1){
        return intensityMap[intensityValues[i]];
      }
    }

  }

  getStormProbability = (category) => {
    const probabilityMap = {
      low: {
        icon: "icons/xl54.png",
      }, 
      med: {
        icon: "icons/xm54.png",
      }, 
      high: {
        icon: "icons/xh54.png",
      }
    }

    if(category === "1"){
      return probabilityMap.low;
    } else if(category === "2"){
      return probabilityMap.med;
    } else {
      return probabilityMap.high;
    }
  }

  outlookToLayer(feature, latlng) {

    var stormProbability = this.getStormProbability(feature.properties['5day_category']);

    var probIcon = L.icon({
      iconUrl: stormProbability.icon,
  
      iconSize:     [27, 27], // size of the icon
      iconAnchor:   [15, 17], // point of the icon which will correspond to marker's location
  });

    

    return L.marker(latlng, {icon: probIcon}).bindPopup(feature.properties.Discussion);;
  }

  getMapLayer = (product, storm) =>{
    switch (product.product){
      case "cone":
        return(<GeoJSON key={"cone_" + storm} data={product.data} interactive={false}/>)
      case "initialwindfield":
        return(<GeoJSON key={"initialwindfield" + storm} data={product.data} interactive={false} style={
          (feature) => {
            return {color: feature.properties.fill}
          }
        }/>)
      case "pasttrack":
        return (<GeoJSON key={"pasttrack_" + storm} data={product.data} pointToLayer={this.pointToLayer.bind(this)}/>)
      case "track":
        return (<GeoJSON key={"track_" + storm} data={product.data} pointToLayer={this.pointToLayer.bind(this)}/>)
      default:
        return(<GeoJSON key={product.product + "_" + storm} data={product.data} onEachFeature={
          (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
            }
        }}/>)
    }
  }

  getOutlookLayer = (outlook, index) => {
    if(outlook.features[0].properties.Disturbance === undefined){
      return;
    }
    return(<GeoJSON key={"outlook_" + index} data={outlook} pointToLayer={this.outlookToLayer.bind(this)} style={
      (feature) => {
        return {
          color: feature.properties.fill
        }
      }
    }/>) 
  }

  render(){
    const position = [this.state.lat, this.state.lng]
    return (
      <Map center={position} zoom={this.state.zoom}>
        <TileLayer
          attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {this.state.storms.map((storm, index) => {
         return(
          storm.products.map((product) => {
            return this.getMapLayer(product, storm.atcfID)
          }))
        })}

        {this.state.storms.map((storm, index) => {
           return(<Marker
              position={new LatLng(parseFloat(storm.centerLat), parseFloat(storm.centerLon))}
              icon = {this.generateStormIcon(storm)}
              >
                <Popup>
                  <strong>{storm.name}</strong>
                  <div>{this.getStormIntensity(this.mphToKts(parseInt(storm.maxSustainedWind.replace(/[^0-9]/g,'')))).category}</div>
                  <hr />
                  <div><strong>Max Sustained Winds: </strong>{storm.maxSustainedWind}</div>
                  <div><strong>Minimum Pressure: </strong>{storm.minimumPressure}</div>
                  <div><strong>Movement: </strong>{storm.movement}</div>
                </Popup>
          </Marker>)
        })}

        {this.state.outlooks.map((outlook, index) => {
          return this.getOutlookLayer(outlook, index);
        })}
      </Map>
    )
  }
}


/*

{this.state.cones.map((cone, index) => {
          return <GeoJSON key={"cone_" + index} data={cone} interactive={false}/>
        })}

        {this.state.wws.map((ww, index) => {
          return <GeoJSON key={"ww_" + index} data={ww} onEachFeature={
            (feature, layer) => {
              if (feature.properties && feature.properties.name) {
                  layer.bindPopup(feature.properties.name);
              }
          }}/>
        })}

        {this.state.tracks.map((track, index) => {
          return <GeoJSON key={"track_" + index} data={track} pointToLayer={this.pointToLayer.bind(this)}/>
        })}

*/