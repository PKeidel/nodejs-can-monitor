#include <SPI.h>
#include "mcp_can.h"

MCP_CAN CAN(10);

int lastSecond = 0;
int count = 0;
int flagRecv = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  while (CAN_OK != CAN.begin(CAN_500KBPS))
    delay(100);
  digitalWrite(LED_BUILTIN, HIGH);

  attachInterrupt(0, MCP2515_ISR, FALLING); // start interrupt
}

void MCP2515_ISR() {
    flagRecv = 1;
}

void loop() {
  if(!flagRecv)
    return;

  unsigned char len = 0;
  unsigned char buf[8];

  if (CAN_MSGAVAIL == CAN.checkReceive()) {
    CAN.readMsgBuf(&len, buf);

    int second = (int) (millis() / 1000);
    if(second != lastSecond) {
      Serial.print("Second ");
      Serial.print(lastSecond);
      Serial.print(": ");
      Serial.println(count);
      count = 0;
      lastSecond = second;
    }
    count++;
  }
}
