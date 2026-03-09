<script lang="ts">
	import { apiRequest } from '$lib/diva-api/apiClient'
	import type { ApiResponse } from '$lib/diva-api/types/apiTypes'
	import {
		FlexRender,
		createSvelteTable,
	} from '$lib/components/ui/data-table'
	import * as Table from '$lib/components/ui/table'
	import { Button } from '$lib/components/ui/button'
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core'

	type UserRow = {
		id: number
		username: string
		email: string
		display_name: string
		roles?: string[] | null
	}

	type DashboardUser = {
		access_token: string
		refresh_token: string
		expires_at: number
	}

	type DashboardData = {
		user: DashboardUser | null
	}

	let { data } = $props<{ data: DashboardData }>()
	const initialUser = $derived(data.user)
	let authState = $state<DashboardUser | null>(null)

	$effect(() => {
		if (!authState && initialUser) {
			authState = initialUser
		}
	})

	function normalizeUsers(payload: unknown): UserRow[] {
		if (Array.isArray(payload)) {
			return payload as UserRow[]
		}

		if (payload && typeof payload === 'object') {
			const objectPayload = payload as Record<string, unknown>

			if (Array.isArray(objectPayload.data)) {
				return objectPayload.data as UserRow[]
			}

			if (Array.isArray(objectPayload.users)) {
				return objectPayload.users as UserRow[]
			}
		}

		return []
	}

	let users = $state<UserRow[]>([])
	let isLoading = $state(false)
	let errorMessage = $state('')

	async function loadUsers() {
		isLoading = true
		errorMessage = ''

		const response: ApiResponse<unknown> = await apiRequest({
			endpoint: 'getUsers',
			method: 'GET',
			requiresAuth: false,
			credentials: 'include',
			authCredentials: {
				access_token: authState?.access_token,
				refresh_token: authState?.refresh_token,
				expires_at: authState?.expires_at,
			},
		})

		isLoading = false

		console.log('API response for getUsers: ', JSON.stringify(response))

		if (!response.success) {
			errorMessage = response.error.message
			users = []
			return
		}

		const refreshedCredentials = response.meta?.authCredentials as
			| {
					access_token?: string
					refresh_token?: string
					expires_at?: number | string
			  }
			| undefined
		if (refreshedCredentials?.access_token) {
			authState = {
				access_token: refreshedCredentials.access_token,
				refresh_token:
					refreshedCredentials.refresh_token ??
					authState?.refresh_token ??
					'',
				expires_at: Number(
					refreshedCredentials.expires_at ??
						authState?.expires_at ??
						Date.now(),
				),
			}
		}

		users = normalizeUsers(response.data)
	}

	const columnHelper = createColumnHelper<UserRow>()

	const columns = [
		columnHelper.accessor('id', {
			header: 'ID',
		}),
		columnHelper.accessor('username', {
			header: 'Username',
		}),
		columnHelper.accessor('email', {
			header: 'Email',
		}),
		columnHelper.accessor('display_name', {
			header: 'Display Name',
		}),
		columnHelper.accessor('roles', {
			header: 'Roles',
			cell: (info) => {
				const roles = info.getValue()
				return Array.isArray(roles) && roles.length > 0
					? roles.join(', ')
					: '-'
			},
		}),
	]

	const table = createSvelteTable({
		get data() {
			return users
		},
		columns,
		getCoreRowModel: getCoreRowModel(),
	})
</script>

<section class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<Button
			class="bg-blue-500 text-white hover:bg-blue-600"
			type="button"
			onclick={loadUsers}
			disabled={isLoading}>
			{isLoading ? 'Loading...' : 'Load Users'}
		</Button>
	</div>

	{#if errorMessage}
		<p class="text-sm text-destructive">{errorMessage}</p>
	{/if}

	{#if users.length > 0}
		<Table.Root>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup}
					<Table.Row>
						{#each headerGroup.headers as header}
							<Table.Head>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()} />
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>

			<Table.Body>
				{#each table.getRowModel().rows as row}
					<Table.Row>
						{#each row.getVisibleCells() as cell}
							<Table.Cell>
								<FlexRender
									content={cell.column.columnDef.cell}
									context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else}
		<p class="text-sm text-muted-foreground">
			Click "Load Users" to fetch authenticated users.
		</p>
	{/if}
</section>
