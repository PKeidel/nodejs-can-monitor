package main

// tinygo flash -target=esp32-coreboard-v2 -port=/dev/ttyUSB0 -size=short randombytes.go

import (
	"math/rand"
	"time"
)

func main() {
	for {
		r := make([]byte, 4)
		if _, err := rand.Read(r); err != nil {
			println("rand.Read error")
			time.Sleep(time.Millisecond * 5000)
			continue
		}
		print(string([]byte{0xAF, r[0] & 0b00111000, r[1], 0xCA, 0xFE, 0xBA, 0xBE, r[2], r[3], 0xFE, 0xFF}))
		time.Sleep(time.Millisecond * 100)
	}
}
