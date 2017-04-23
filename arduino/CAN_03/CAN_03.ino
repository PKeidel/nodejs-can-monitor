#include <SPI.h>
#include "mcp_can.h"

MCP_CAN CAN(10);
int flagRecv = 0;
INT32U canId;
int messages = 0;
unsigned char chars[80];
int idx = 0;
unsigned char len = 0;
unsigned char buf[8];
bool all = false;

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

  len = 0;
  buf[8];

  if (CAN_MSGAVAIL == CAN.checkReceive()) {
    CAN.readMsgBuf(&len, buf);

    canId = CAN.getCanId();

    // idx = 0;
    chars[idx++] = (unsigned char) (canId >> 8);
    chars[idx++] = (unsigned char) canId;

    all = false;
    for (int i = 0; i < len; i++) {
      if(all || buf[i] > 0) {
        all = true;
        chars[idx++] = buf[i];
      }
    }
    chars[idx++] = 0xFE;
    chars[idx++] = 0xFF;
    messages++;

    // value of 'messages' is 'messageCount - 1'
    // collecting 4 messages, then send
    if(messages > 2) {
      // sendToPC(chars, idx);
      Serial.write(chars, idx);
      // Serial.println(idx);
      messages = 0;
      idx = 0;
    }
  }
}