export class IpnHandlerService {
  handleIpn(body: ReadableStream<Uint8Array<ArrayBuffer>>) {
    return { success: true };
  }
}
