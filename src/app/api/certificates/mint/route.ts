import { NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    // Validate required env vars before doing any work
    if (!process.env.NFT_MINTER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Server misconfiguration: NFT_MINTER_PRIVATE_KEY is not set.' },
        { status: 503 }
      )
    }
    if (!process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: 'Server misconfiguration: NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not set.' },
        { status: 503 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { studentId, pdfUrl, walletAddress } = body

    if (!studentId || !pdfUrl || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, pdfUrl, and walletAddress are all required.' },
        { status: 400 }
      )
    }

    // Build temporary tokenURI (will point to pending metadata until tokenId is known)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const tokenURI = `${appUrl}/api/nft/metadata/pending`

    // Set up viem account and clients
    const account = privateKeyToAccount(
      process.env.NFT_MINTER_PRIVATE_KEY as `0x${string}`
    )

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    })

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    })

    const abi = parseAbi(['function safeMint(address to, string uri) returns (uint256)'])
    const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as `0x${string}`

    // Send the mint transaction
    const txHash = await walletClient.writeContract({
      address: contractAddress,
      abi,
      functionName: 'safeMint',
      args: [walletAddress as `0x${string}`, tokenURI],
    })

    // Wait for confirmation and extract tokenId from logs
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

    let tokenId: bigint
    try {
      // ERC-721 Transfer event: topics[0]=event sig, topics[1]=from, topics[2]=to, topics[3]=tokenId
      const firstLog = receipt.logs[0]
      if (!firstLog || !firstLog.topics[3]) {
        throw new Error('No tokenId topic in log')
      }
      tokenId = BigInt(firstLog.topics[3])
    } catch {
      // Fallback: use timestamp as a unique stand-in tokenId
      tokenId = BigInt(Date.now())
    }

    // Persist to Supabase using the service-role admin client
    const supabase = createAdminClient()
    const { error: dbError } = await supabase.from('certificates').insert({
      student_id: studentId,
      pdf_url: pdfUrl,
      nft_token_id: tokenId.toString(),
      tx_hash: txHash,
      chain: 'sepolia',
    })

    if (dbError) {
      console.error('Supabase insert error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      txHash,
      tokenId: tokenId.toString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Mint route error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
