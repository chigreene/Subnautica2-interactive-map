using System.Runtime.InteropServices;

namespace SN2Companion.Memory;

internal static class NativeMethods
{
    public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    public const uint PROCESS_VM_READ = 0x0010;

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern nint OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool ReadProcessMemory(nint hProcess, nint lpBaseAddress, byte[] lpBuffer, int dwSize, out nint lpNumberOfBytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(nint hObject);
}
