using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace SN2Companion.Memory;

public sealed class ProcessMemoryReader : IDisposable
{
    private readonly Process _process;
    private readonly nint _handle;

    private ProcessMemoryReader(Process process, nint handle)
    {
        _process = process;
        _handle = handle;
    }

    public static ProcessMemoryReader? TryOpen(string processName)
    {
        var nameWithoutExe = processName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
            ? processName[..^4]
            : processName;

        var process = Process.GetProcessesByName(nameWithoutExe).FirstOrDefault();
        if (process is null) return null;

        var handle = NativeMethods.OpenProcess(
            NativeMethods.PROCESS_QUERY_LIMITED_INFORMATION | NativeMethods.PROCESS_VM_READ,
            false,
            process.Id
        );

        if (handle == nint.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "OpenProcess failed");
        }

        return new ProcessMemoryReader(process, handle);
    }

    public long GetModuleBaseAddress(string moduleName)
    {
        foreach (ProcessModule module in _process.Modules)
        {
            if (module.ModuleName.Equals(moduleName, StringComparison.OrdinalIgnoreCase))
            {
                return module.BaseAddress.ToInt64();
            }
        }

        throw new InvalidOperationException($"Module not found: {moduleName}");
    }

    public float ReadFloat(long address)
    {
        var bytes = ReadBytes(address, 4);
        return BitConverter.ToSingle(bytes, 0);
    }

    public double ReadDouble(long address)
    {
        var bytes = ReadBytes(address, 8);
        return BitConverter.ToDouble(bytes, 0);
    }

    public long ReadPointer(long address)
    {
        var bytes = ReadBytes(address, nint.Size);
        return nint.Size == 8 ? BitConverter.ToInt64(bytes, 0) : BitConverter.ToInt32(bytes, 0);
    }

    public byte[] ReadBytes(long address, int length)
    {
        var buffer = new byte[length];
        if (!NativeMethods.ReadProcessMemory(_handle, new nint(address), buffer, buffer.Length, out var bytesRead))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), $"ReadProcessMemory failed at 0x{address:X}");
        }

        if (bytesRead.ToInt32() != length)
        {
            throw new InvalidOperationException($"Only read {bytesRead} of {length} bytes at 0x{address:X}");
        }

        return buffer;
    }

    public void Dispose()
    {
        if (_handle != nint.Zero) NativeMethods.CloseHandle(_handle);
        _process.Dispose();
    }
}
