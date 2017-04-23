# README #

This is a project to decode and visualize CAN messages of cars.

* For Development: IntelliJ
* Arduino with CAN Shield
* npm start
* http://localhost:3000
* select the USB Port which the arduino is connected to
* Communication nodejs <-> Webpage via WebSockets


![sequence image][sequence]

### Quick Usage guide
* Select an input on the top left
* "Ignore Start" to start capturing bytes that should be ignored
* Click on a Hex value, to watch this Byte
* STRG+Click on a Hex value, to toggle ignore of that Byte
* "M" to save the Value to the "known" list


### Screenshots ###

#### Main GUI
![main gui image][maingui]

#### Watching Values
![watching values image][watchingvalues]

#### Sidebar
![sequence image][sidebar]


### Example Data ###

Car Model: Hyundai i30
* logs/logfile_2016-08-05T21:35:08.329Z.txt

Test/Demo data can be loaded by clicking "Random"




[sequence]: doc/sequence.png "Sequence Diagram"
[maingui]: doc/gui01.png "Main GUI"
[watchingvalues]: doc/watching_values.png "Watching Values"
[sidebar]: doc/sidebar.png "Sidebar"
