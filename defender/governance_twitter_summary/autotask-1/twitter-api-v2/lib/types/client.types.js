"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETwitterStreamEvent = void 0;
var ETwitterStreamEvent;
(function (ETwitterStreamEvent) {
    ETwitterStreamEvent["Connected"] = "connected";
    ETwitterStreamEvent["ConnectError"] = "connect error";
    ETwitterStreamEvent["ConnectionError"] = "connection error";
    ETwitterStreamEvent["ConnectionClosed"] = "connection closed";
    ETwitterStreamEvent["ConnectionLost"] = "connection lost";
    ETwitterStreamEvent["ReconnectAttempt"] = "reconnect attempt";
    ETwitterStreamEvent["Reconnected"] = "reconnected";
    ETwitterStreamEvent["ReconnectError"] = "reconnect error";
    ETwitterStreamEvent["ReconnectLimitExceeded"] = "reconnect limit exceeded";
    ETwitterStreamEvent["DataKeepAlive"] = "data keep-alive";
    ETwitterStreamEvent["Data"] = "data event content";
    ETwitterStreamEvent["DataError"] = "data twitter error";
    ETwitterStreamEvent["TweetParseError"] = "data tweet parse error";
    ETwitterStreamEvent["Error"] = "stream error";
})(ETwitterStreamEvent = exports.ETwitterStreamEvent || (exports.ETwitterStreamEvent = {}));
