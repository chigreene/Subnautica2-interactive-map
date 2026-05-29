namespace SN2Companion.Memory;

public sealed class MemoryOptions
{
    public string ProcessName { get; set; } = "Subnautica2";
    public string ModuleName { get; set; } = "Subnautica2-Win64-Shipping.exe";
    public string AddressMode { get; set; } = "pointer-chain";
    public string BaseOffsetHex { get; set; } = "0x0";
    public string[] PointerOffsetsHex { get; set; } = Array.Empty<string>();
    public string XOffsetHex { get; set; } = "0x0";
    public string YOffsetHex { get; set; } = "0x4";
    public string ZOffsetHex { get; set; } = "0x8";
    public string YawOffsetHex { get; set; } = "0xC";
    public string AbsoluteXAddressHex { get; set; } = string.Empty;
    public string AbsoluteYAddressHex { get; set; } = string.Empty;
    public string AbsoluteZAddressHex { get; set; } = string.Empty;
    public string AbsoluteYawAddressHex { get; set; } = string.Empty;
}
